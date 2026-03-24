import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { PriceObservation, AvailabilityStatus } from '../../entities/PriceObservation';
import { ProviderAccomType } from '../../entities/ProviderAccomType';
import { ProviderPark } from '../../entities/ProviderPark';
import { geocodePark } from '../../services/geocoding.service';
import { FetchRun, RunType, RunStatus, ProviderStatus } from '../../entities/FetchRun';
import { adapterRegistry } from '../../adapters/registry';
import { MonitorJobData, addInsightJob } from '../queues';
import { generateSeriesKey } from '../../utils/series-key';
import { SystemLogger } from '../../services/SystemLogger';
import { LocationNotFoundError } from '../../utils/errors';

const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
const observationRepo = AppDataSource.getRepository(PriceObservation);
const fetchRunRepo = AppDataSource.getRepository(FetchRun);
const accomTypeRepo = AppDataSource.getRepository(ProviderAccomType);
const parkRepo = AppDataSource.getRepository(ProviderPark);

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

    // Save the initial run record
    await fetchRunRepo.save(fetchRun);

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

        // If no results, mark as no results found
        if (results.length === 0) {
            fetchRun.status = RunStatus.NO_RESULTS;
            fetchRun.providerStatus = ProviderStatus.OK;
            fetchRun.errorMessage = 'No availability found for this period';
            fetchRun.finishedAt = new Date();

            const region = searchParams.region || 'Unknown';
            const startDate = searchParams.dateWindow.start;
            const adults = searchParams.party.adults;
            const children = searchParams.party.children || 0;
            const message = `${fingerprint.provider.name}: No results for "${region}" (Start: ${startDate}, Party: ${adults}a/${children}c)`;

            await SystemLogger.warn(
                message,
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
                let accomTypeEntity: ProviderAccomType | null = null;

                if (result.accomType) {
                    // Try to find existing accom type by name and provider
                    accomTypeEntity = await accomTypeRepo.findOne({
                        where: {
                            provider: { id: fingerprint.provider.id },
                            name: result.accomType
                        }
                    });

                    // If not found, create it
                    if (!accomTypeEntity) {
                        try {
                            accomTypeEntity = accomTypeRepo.create({
                                provider: fingerprint.provider,
                                name: result.accomType,
                                providerAccomCode: result.accomType // Use name as code fallback for now
                            });
                            await accomTypeRepo.save(accomTypeEntity);
                        } catch (_e) {
                            // Handle race condition where another worker might have created it
                            accomTypeEntity = await accomTypeRepo.findOne({
                                where: {
                                    provider: { id: fingerprint.provider.id },
                                    name: result.accomType
                                }
                            });
                        }
                    }
                }

                // Look up park if parkId provided
                let parkEntity: ProviderPark | null = null;
                if (result.parkId) {
                    // console.log(`🏞️  Looking up park with parkId: ${result.parkId} for provider: ${fingerprint.provider.id}`);
                    parkEntity = await parkRepo.findOne({
                        where: {
                            provider: { id: fingerprint.provider.id },
                            providerParkCode: result.parkId
                        }
                    });

                    // Auto-Create Logic: If park not found but we have details, create it
                    if (!parkEntity && result.propertyName) {
                        console.log(`✨ Park not found, creating new park: ${result.propertyName} (${result.parkId})`);
                        try {
                            parkEntity = parkRepo.create({
                                provider: fingerprint.provider,
                                providerParkCode: result.parkId,
                                name: result.propertyName,
                                region: result.location
                            });
                            await parkRepo.save(parkEntity);
                            console.log(`✅  Created park: ${parkEntity.name}`);
                            // Fire-and-forget geocoding — don't block the monitor job
                            geocodePark(parkEntity).catch(() => {});
                        } catch (e: unknown) {
                            // Handle race condition (unique constraint violation)
                            if ((e as any).message.includes('unique') || (e as any).code === '23505') {
                                console.log(`⚠️ Park already created by another worker, refetching...`);
                                parkEntity = await parkRepo.findOne({
                                    where: {
                                        provider: { id: fingerprint.provider.id },
                                        providerParkCode: result.parkId
                                    }
                                });
                            } else {
                                console.error(`❌ Failed to create park:`, e);
                            }
                        }
                    } else if (parkEntity) {
                        // console.log(`✅ Found existing park: ${parkEntity.name}`);
                    } else {
                        console.log(`⚠️  Park ID ${result.parkId} found but no name provided in result, cannot create.`);
                    }
                } else {
                    // console.log(`⚠️  No parkId in result for series`);
                }

                // Generate series key
                const seriesKey = generateSeriesKey({
                    providerId: fingerprint.provider.id,
                    stayStartDate: result.stayStartDate,
                    stayNights: result.stayNights,
                    parkId: result.parkId,
                    accomTypeId: accomTypeEntity?.id || result.accomType, // Prefer ID if available
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
                    availability: (result.availability as AvailabilityStatus) || AvailabilityStatus.AVAILABLE,
                    sourceUrl: result.sourceUrl,
                    accomType: accomTypeEntity || undefined,
                    park: parkEntity || undefined,
                });

                await observationRepo.insert(observation as any);
                storedCount++;
            } catch (err) {
                console.error(`Failed to store observation:`, err);
                // Continue with other results
            }
        }

        console.log(`💾 Stored ${storedCount}/${results.length} observations`);

        // Update fetch run for success
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
        console.error(`❌ Monitor job failed for fingerprint ${job.data.fingerprintId}:`, error);

        // Log critical failure to System Logs
        await SystemLogger.error(
            `Monitor Job Failed: ${errorMessage}`,
            'Worker_Monitor',
            { fingerprintId, providerId, stack: error instanceof Error ? error.stack : undefined }
        );

        // Update fetch run with error
        fetchRun.status = error instanceof LocationNotFoundError ? RunStatus.INVALID_LOCATION : RunStatus.ERROR;
        fetchRun.errorMessage = errorMessage;
        fetchRun.finishedAt = new Date();

        if (errorMessage.includes('timeout')) {
            fetchRun.providerStatus = ProviderStatus.TIMEOUT;
        } else if (errorMessage.includes('blocked') || errorMessage.includes('403')) {
            fetchRun.providerStatus = ProviderStatus.BLOCKED;
        } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
            fetchRun.providerStatus = ProviderStatus.PARSE_FAILED;
        } else {
            fetchRun.providerStatus = ProviderStatus.FETCH_FAILED;
        }

        await fetchRunRepo.save(fetchRun);
        throw error; // Let BullMQ handle retry
    }
}

export const monitorWorker = new Worker('monitor', processMonitorJob, {
    connection: new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    }),
    concurrency: parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2'),
});

monitorWorker.on('error', (err) => {
    console.error('❌ Monitor Worker Connection Error:', err);
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
