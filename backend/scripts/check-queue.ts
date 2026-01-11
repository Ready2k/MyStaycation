
import { Queue } from 'bullmq';
import { redisConnection } from '../src/config/redis';
import * as dotenv from 'dotenv';
dotenv.config();

// Ensure we connect to localhost for this script
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

async function main() {
    const monitorQueue = new Queue('monitor', { connection: redisConnection });
    const counts = await monitorQueue.getJobCounts();
    console.log('Queue Counts:', counts);

    // Check if there are waiting jobs
    const waiting = await monitorQueue.getWaiting();
    if (waiting.length > 0) {
        console.log('Sample waiting job:', JSON.stringify(waiting[0].data, null, 2));
    }

    // DRAIN QUEUE
    console.log('Draining queue...');
    await monitorQueue.drain(true); // true = delayed jobs too

    // Add new job
    const data = {
        fingerprintId: '43c78642-0d67-4994-94fa-be5a39a53f2f',
        providerId: '7cc332a1-df65-4c83-a6a1-08c0b5db60c4',
        searchParams: { "pets": true, "party": { "adults": 4, "children": 0 }, "nights": { "max": 7, "min": 7 }, "region": "Cornwall", "provider": "hoseasons", "dateWindow": { "end": "2026-08-17", "start": "2026-08-10" }, "minBedrooms": 0, "peakTolerance": "MIXED" }
    };
    await monitorQueue.add('monitor-search', data, {
        jobId: `force-monitor-${Date.now()}`,
        attempts: 2
    });
    console.log('Added new job');

    await monitorQueue.close();
    await redisConnection.disconnect();
}

main().catch(console.error);
