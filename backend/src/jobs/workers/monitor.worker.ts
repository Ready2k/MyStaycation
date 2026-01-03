import { Worker, Job } from 'bullmq';
import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { PriceObservation, AvailabilityStatus } from '../../entities/PriceObservation';
import { FetchRun, RunType, RunStatus } from '../../entities/FetchRun';
import { adapterRegistry } from '../../adapters/registry';
import { MonitorJobData } from '../queues';
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
        // Get the appropriate adapter
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['provider'],
        });

        if (!fingerprint) {
            throw new Error(`Fingerprint ${fingerprintId} not found`);
        }

        const adapter = adapterRegistry.getAdapter(fingerprint.provider.code);

        // Execute search
        const results = await adapter.search(searchParams);

        fetchRun.status = RunStatus.OK;
        fetchRun.httpStatus = 200;

        // Store price observations
        for (const result of results) {
            const observation = observationRepo.create({
                provider: { id: providerId },
                fingerprint: { id: fingerprintId },
                fetchRun,
                stayStartDate: new Date(result.stayStartDate),
                stayNights: result.stayNights,
                priceTotalGbp: result.priceTotalGbp,
                pricePerNightGbp: result.pricePerNightGbp,
                availability: result.availability as AvailabilityStatus,
                sourceUrl: result.sourceUrl,
                partySize: searchParams.party,
            });

            await observationRepo.save(observation);
        }

        console.log(`✅ Stored ${results.length} observations for fingerprint ${fingerprintId}`);

        // Update fingerprint last scheduled time
        fingerprint.lastScheduledAt = new Date();
        await fingerprintRepo.save(fingerprint);

    } catch (error: any) {
        console.error(`❌ Monitor job failed for fingerprint ${fingerprintId}:`, error);

        fetchRun.status = error.message.includes('robots.txt') ? RunStatus.BLOCKED : RunStatus.ERROR;
        fetchRun.errorMessage = error.message;
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
