import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { AppDataSource } from '../../config/database';
import { dealService } from '../../services/deal.service';
import { DealJobData } from '../queues';
import { Provider } from '../../entities/Provider';

const providerRepo = AppDataSource.getRepository(Provider);

async function processDealJob(job: Job<DealJobData>) {
    const { providerId } = job.data;

    try {
        if (providerId === 'ALL') {
            await dealService.scanAllProviders();
        } else {
            const provider = await providerRepo.findOne({ where: { id: providerId } });
            if (provider) {
                await dealService.scanProvider(provider);
            } else {
                console.error(`Provider ${providerId} not found for deal scan`);
            }
        }
    } catch (error) {
        console.error('Deal scan job failed:', error);
        throw error;
    }
}

export const dealWorker = new Worker('deals', processDealJob, {
    connection: redisConnection,
    concurrency: 1, // Serial scanning to be polite
    limiter: {
        max: 1,
        duration: 5000 // Rate limit deal scans
    }
});

dealWorker.on('completed', (job) => {
    console.log(`✅ Deal job ${job.id} completed`);
});
