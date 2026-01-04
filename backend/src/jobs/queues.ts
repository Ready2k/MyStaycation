import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { redisConnection } from '../config/redis';

export const monitorQueue = new Queue('monitor', { connection: redisConnection });
export const dealQueue = new Queue('deals', { connection: redisConnection });
export const insightQueue = new Queue('insights', { connection: redisConnection });
export const alertQueue = new Queue('alerts', { connection: redisConnection });

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

/**
 * Add alert job with idempotency
 */
export async function addAlertJob(data: AlertJobData): Promise<void> {
    const jobId = `alert:${data.userId}:${data.insightId}`;

    await alertQueue.add('send-alert', data, {
        jobId, // Prevents duplicate alerts for same insight
        removeOnComplete: 100,
        removeOnFail: 50,
    });
}

/**
 * Add deal scan job
 */
export async function addDealScanJob(data: DealJobData): Promise<void> {
    const jobId = `deal-scan:${data.providerId}:${new Date().toISOString().split('T')[0]}`;

    await dealQueue.add('scan-deals', data, {
        jobId, // Deduplicate daily scans
        removeOnComplete: 100,
        removeOnFail: 100
    });
}
