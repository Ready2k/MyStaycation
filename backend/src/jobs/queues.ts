import { Queue } from 'bullmq';
import IORedis from 'ioredis';

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
