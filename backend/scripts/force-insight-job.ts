import { Queue } from 'bullmq';
import { redisConnection } from '../src/config/redis';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

async function main() {
    const insightQueue = new Queue('insights', { connection: redisConnection });

    const data = {
        fingerprintId: '88f72161-1f84-47b9-a0a2-e7dac624f78b'
    };

    await insightQueue.add('generate-insights', data, {
        jobId: `insight-devon-${Date.now()}`,
        attempts: 2
    });

    console.log('Added insight generation job for Devon profile');

    await insightQueue.close();
    await redisConnection.disconnect();
}

main().catch(console.error);
