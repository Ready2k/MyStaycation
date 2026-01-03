import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import * as crypto from 'crypto';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
});

export const monitorQueue = new Queue('monitor', { connection });
export const dealQueue = new Queue('deals', { connection });
export const insightQueue = new Queue('insights', { connection });
export const alertQueue = new Queue('alerts', { connection });

export interface MonitorJobData {
    fingerprintId: string;
    providerId: string;
    searchParams: any;
}

export interface DealJobData {
    providerId: string;
}

export interface InsightJobData {
    fingerprintId: string;
}

export interface AlertJobData {
    userId: string;
    insightId: string;
    profileId?: string;
}

/**
 * Generate idempotency key for monitoring jobs
 * Prevents duplicate jobs for the same fingerprint within a time window
 */
export function generateMonitorJobId(fingerprintId: string, windowStart: Date): string {
    // Use date truncated to hour for idempotency window
    const hourKey = windowStart.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    return crypto.createHash('sha256').update(`monitor:${fingerprintId}:${hourKey}`).digest('hex');
}

/**
 * Add monitoring job with idempotency
 */
export async function addMonitorJob(data: MonitorJobData): Promise<void> {
    const jobId = generateMonitorJobId(data.fingerprintId, new Date());

    await monitorQueue.add('monitor-search', data, {
        jobId, // BullMQ uses jobId for deduplication
        removeOnComplete: 100,
        removeOnFail: 100,
    });
}

/**
 * Add insight generation job with idempotency
 */
export async function addInsightJob(data: InsightJobData): Promise<void> {
    const jobId = `insight:${data.fingerprintId}:${new Date().toISOString().split('T')[0]}`;

    await insightQueue.add('generate-insights', data, {
        jobId,
        removeOnComplete: 50,
        removeOnFail: 50,
    });
}
