import { Worker, Job } from 'bullmq';
import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { PriceObservation, AvailabilityStatus } from '../../entities/PriceObservation';
import { FetchRun, RunType, RunStatus } from '../../entities/FetchRun';
import { adapterRegistry } from '../../adapters/registry';
import { MonitorJobData, addInsightJob } from '../queues';
import { generateSeriesKey } from '../../utils/series-key';
import { redisConnection } from '../../config/redis';
import { SystemLogger } from '../../services/SystemLogger';

const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
// ... existing code ...

// Execute search
const results = await adapter.search(searchParams);

// If no results, mark as parse failed (might be HTML structure change)
if (results.length === 0) {
    fetchRun.status = RunStatus.PARSE_FAILED;
    fetchRun.errorMessage = 'No results parsed from provider response';

    await SystemLogger.warn(
        `No results parsed from ${fingerprint.provider.code}`,
        'Worker_Monitor',
        { fingerprintId, providerId, params: searchParams }
    );
    return;
}

        // ... existing code ...

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
    // ... existing code ...
} finally {
    // ... existing code ...
}
}

export const monitorWorker = new Worker('monitor', processMonitorJob, {
    connection: redisConnection,
    concurrency: parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2'),
});

monitorWorker.on('completed', (job) => {
    // Optional: Log success if verbose
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

