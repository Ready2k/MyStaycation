import { Queue } from 'bullmq';
import { redisConnection } from '../src/config/redis';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

async function main() {
    const insightQueue = new Queue('insights', { connection: redisConnection });
    const counts = await insightQueue.getJobCounts();
    console.log('Insight Queue Counts:', counts);

    const waiting = await insightQueue.getWaiting();
    if (waiting.length > 0) {
        console.log('Sample waiting job:', JSON.stringify(waiting[0].data, null, 2));
    }

    await insightQueue.close();
    await redisConnection.disconnect();
}

main().catch(console.error);
