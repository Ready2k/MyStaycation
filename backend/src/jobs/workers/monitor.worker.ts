import { Worker, Job } from 'bullmq';
import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { PriceObservation, AvailabilityStatus } from '../../entities/PriceObservation';
import { FetchRun, RunType, RunStatus, ProviderStatus } from '../../entities/FetchRun';
import { adapterRegistry } from '../../adapters/registry';
import { MonitorJobData, addInsightJob } from '../queues';
import { generateSeriesKey } from '../../utils/series-key';
import { redisConnection } from '../../config/redis';
import { SystemLogger } from '../../services/SystemLogger';

const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
const observationRepo = AppDataSource.getRepository(PriceObservation);
const fetchRunRepo = AppDataSource.getRepository(FetchRun);

async function processMonitorJob(job: Job<MonitorJobData>) {
    const { fingerprintId, providerId, searchParams } = job.data;

    console.log(`🔍 Monitoring fingerprint ${fingerprintId} via ${providerId}`);

    // Create fetch run record
    const fetchRun = fetchRunRepo.create({
        provider: { id: providerId } as any,
        fingerprint: { id: fingerprintId } as any,
        runType: RunType.SEARCH,
        scheduledFor: new Date(),
        startedAt: new Date(),
        status: RunStatus.OK,
        providerStatus: ProviderStatus.OK,
    });

    try {
        // Load fingerprint with relations
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['provider', 'profile'],
        });

        if (!fingerprint) {
            throw new Error(`Fingerprint ${fingerprintId} not found`);
        }

        // Get adapter
        const adapter = adapterRegistry.getAdapter(fingerprint.provider.code);

        if (!adapter.isEnabled()) {
            console.log(`⚠️  Provider ${fingerprint.provider.code} is disabled, skipping`);
            fetchRun.status = RunStatus.ERROR;
            fetchRun.providerStatus = ProviderStatus.BLOCKED;
            fetchRun.errorMessage = 'Provider disabled';
            await fetchRunRepo.save(fetchRun);
            return;
        }

        // Execute search
        const results = await adapter.search(searchParams);

        // If no results, mark as parse failed (might be HTML structure change)
        if (results.length === 0) {
            fetchRun.status = RunStatus.PARSE_FAILED;
            fetchRun.providerStatus = ProviderStatus.PARSE_FAILED;
            fetchRun.errorMessage = 'No results parsed from provider response';

            await SystemLogger.warn(
                `No results parsed from ${fingerprint.provider.code}`,
                'Worker_Monitor',
                { fingerprintId, providerId, params: searchParams }
            );

            await fetchRunRepo.save(fetchRun);
            return;
        }

        console.log(`✅ Found ${results.length} results for fingerprint ${fingerprintId}`);

        // Store observations
        let storedCount = 0;
        for (const result of results) {
            try {
                // Generate series key
                const seriesKey = generateSeriesKey({
                    providerId: fingerprint.provider.id,
                    stayStartDate: result.stayStartDate,
                    stayNights: result.stayNights,
                    parkId: result.parkId,
                    accomTypeId: result.accomType,
                });

                // Create observation
                const observation = observationRepo.create({
                    provider: fingerprint.provider,
                    fingerprint,
                    fetchRun,
                    stayStartDate: new Date(result.stayStartDate),
                    stayNights: result.stayNights,
                    seriesKey,
                    partySize: {
                        adults: searchParams.party.adults,
                        children: searchParams.party.children,
                    },
                    priceTotalGbp: result.priceTotalGbp,
                    pricePerNightGbp: result.pricePerNightGbp || result.priceTotalGbp / result.stayNights,
                    availability: result.availability || AvailabilityStatus.AVAILABLE,
                    sourceUrl: result.sourceUrl,
                });

                await observationRepo.save(observation);
                storedCount++;
            } catch (err) {
                console.error(`Failed to store observation:`, err);
                // Continue with other results
            }
        }

        console.log(`💾 Stored ${storedCount}/${results.length} observations`);

        // Update fetch run
        fetchRun.finishedAt = new Date();
        fetchRun.status = RunStatus.OK;
        fetchRun.providerStatus = ProviderStatus.OK;
        await fetchRunRepo.save(fetchRun);

        // Queue insight generation
        await addInsightJob({ fingerprintId });

        // Update fingerprint last scheduled time
        fingerprint.lastScheduledAt = new Date();
        await fingerprintRepo.save(fingerprint);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Monitor job failed for fingerprint ${fingerprintId}:`, error);

        // Log critical failure to System Logs
        await SystemLogger.error(
            `Monitor Job Failed: ${errorMessage}`,
            'Worker_Monitor',
            { fingerprintId, providerId, stack: error instanceof Error ? error.stack : undefined }
        );

        // Determine failure type
        fetchRun.finishedAt = new Date();
        fetchRun.status = RunStatus.ERROR;

        if (errorMessage.includes('timeout')) {
            fetchRun.providerStatus = ProviderStatus.TIMEOUT;
        } else if (errorMessage.includes('blocked') || errorMessage.includes('403')) {
            fetchRun.providerStatus = ProviderStatus.BLOCKED;
        } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
            fetchRun.providerStatus = ProviderStatus.PARSE_FAILED;
        } else {
            fetchRun.providerStatus = ProviderStatus.FETCH_FAILED;
        }

        fetchRun.errorMessage = errorMessage;
        await fetchRunRepo.save(fetchRun);

        throw error; // Let BullMQ handle retry
    }
}

export const monitorWorker = new Worker('monitor', processMonitorJob, {
    connection: redisConnection,
    concurrency: parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2'),
});

monitorWorker.on('completed', (job) => {
    console.log(`✅ Monitor job ${job.id} completed`);
});

monitorWorker.on('failed', async (job, err) => {
    // Double log here in case it failed outside the process function
    if (job) {
        await SystemLogger.error(
            `BullMQ Job Failed: ${err.message}`,
            'Worker_Monitor_Queue',
            { jobId: job.id, name: job.name }
        );
    }
    console.error(`❌ Monitor job ${job?.id} failed:`, err);
});
