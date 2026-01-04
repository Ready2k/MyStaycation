import { Worker, Job } from 'bullmq';
import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { PriceObservation, AvailabilityStatus } from '../../entities/PriceObservation';
import { FetchRun, RunType, RunStatus } from '../../entities/FetchRun';
import { adapterRegistry } from '../../adapters/registry';
import { MonitorJobData, addInsightJob } from '../queues';
import { generateSeriesKey } from '../../utils/series-key';
import IORedis from 'ioredis';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
const observationRepo = AppDataSource.getRepository(PriceObservation);
const fetchRunRepo = AppDataSource.getRepository(FetchRun);

async function processMonitorJob(job: Job<MonitorJobData>) {
    const { fingerprintId, providerId, searchParams } = job.data;

    console.log(`🔍 Processing monitor job for fingerprint ${fingerprintId}`);

    // Check if scraping is enabled
    if (process.env.SCRAPING_ENABLED === 'false') {
        console.log('⚠️  Scraping is disabled globally, skipping job');
        return;
    }

    // Create fetch run record
    const fetchRun = fetchRunRepo.create({
        provider: { id: providerId },
        fingerprint: { id: fingerprintId },
        runType: RunType.SEARCH,
        scheduledFor: new Date(),
        startedAt: new Date(),
        status: RunStatus.OK,
    });

    try {
        // Get the fingerprint with provider info
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['provider', 'park'],
        });

        if (!fingerprint) {
            throw new Error(`Fingerprint ${fingerprintId} not found`);
        }

        // Get the appropriate adapter
        const adapter = adapterRegistry.getAdapter(fingerprint.provider.code);

        // Check if adapter is enabled
        if (!adapter.isEnabled()) {
            fetchRun.status = RunStatus.BLOCKED;
            fetchRun.errorMessage = 'Provider adapter is disabled via environment variables';
            console.log(`⚠️  Adapter ${fingerprint.provider.code} is disabled, marking as BLOCKED`);
            return;
        }

        // Execute search
        const results = await adapter.search(searchParams);

        // If no results, mark as parse failed (might be HTML structure change)
        if (results.length === 0) {
            fetchRun.status = RunStatus.PARSE_FAILED;
            fetchRun.errorMessage = 'No results parsed from provider response';
            console.warn(`⚠️  No results parsed for fingerprint ${fingerprintId}`);
            return;
        }

        fetchRun.status = RunStatus.OK;
        fetchRun.httpStatus = 200;

        // Store price observations - only valid results
        let storedCount = 0;
        for (const result of results) {
            // Additional validation before storing
            if (!result.stayStartDate || !result.stayNights || !result.priceTotalGbp) {
                console.warn('Skipping invalid result:', result);
                continue;
            }

            // Generate series key for like-for-like comparisons
            const seriesKey = generateSeriesKey({
                providerId,
                stayStartDate: result.stayStartDate,
                stayNights: result.stayNights,
                parkId: fingerprint.park?.id,
                accomTypeId: result.accomType ? undefined : undefined, // TODO: map accomType string to ID
            });

            const observation = observationRepo.create({
                provider: { id: providerId },
                fingerprint: { id: fingerprintId },
                fetchRun,
                stayStartDate: new Date(result.stayStartDate),
                stayNights: result.stayNights,
                seriesKey,
                priceTotalGbp: result.priceTotalGbp,
                pricePerNightGbp: result.pricePerNightGbp,
                availability: result.availability as AvailabilityStatus,
                sourceUrl: result.sourceUrl,
                partySize: searchParams.party,
            });

            await observationRepo.save(observation);
            storedCount++;
        }

        console.log(`✅ Stored ${storedCount} valid observations for fingerprint ${fingerprintId}`);

        // Trigger insight generation if we stored new observations
        if (storedCount > 0) {
            await addInsightJob({ fingerprintId });
            console.log(`🧠 Queued insight generation for fingerprint ${fingerprintId}`);
        }

        // Update fingerprint last scheduled time
        fingerprint.lastScheduledAt = new Date();
        await fingerprintRepo.save(fingerprint);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Monitor job failed for fingerprint ${fingerprintId}:`, error);

        // Determine failure type
        if (errorMessage.includes('robots.txt')) {
            fetchRun.status = RunStatus.BLOCKED;
        } else if (errorMessage.includes('parse') || errorMessage.includes('selector')) {
            fetchRun.status = RunStatus.PARSE_FAILED;
        } else {
            fetchRun.status = RunStatus.ERROR;
        }

        fetchRun.errorMessage = errorMessage;
    } finally {
        fetchRun.finishedAt = new Date();
        await fetchRunRepo.save(fetchRun);
    }
}

export const monitorWorker = new Worker('monitor', processMonitorJob, {
    connection,
    concurrency: parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2'),
});

monitorWorker.on('completed', (job) => {
    console.log(`✅ Monitor job ${job.id} completed`);
});

monitorWorker.on('failed', (job, err) => {
    console.error(`❌ Monitor job ${job?.id} failed:`, err);
});
