import { Worker, Job } from 'bullmq';
import { alertService } from '../../services/alert.service';
import { AlertJobData } from '../queues';
import { redisConnection } from '../../config/redis';

async function processAlertJob(job: Job<AlertJobData>) {
    const { userId, insightId, profileId } = job.data;

    console.log(`📧 Processing alert for user ${userId}, insight ${insightId}`);

    try {
        // Create and send alert
        const alert = await alertService.createAlert({
            userId,
            insightId,
            profileId,
            channel: 'EMAIL', // Start with email only
        });

        if (alert) {
            console.log(`✅ Alert ${alert.id} created and sent`);
        } else {
            console.log(`ℹ️  Alert skipped (likely duplicate or user preference)`);
        }

    } catch (error) {
        console.error(`❌ Alert processing failed:`, error);
        throw error; // Let BullMQ handle retry
    }
}

export const alertWorker = new Worker('alerts', processAlertJob, {
    connection: redisConnection,
    concurrency: 10, // Emails can be sent in parallel
});

alertWorker.on('completed', (job) => {
    console.log(`✅ Alert job ${job.id} completed`);
});

alertWorker.on('failed', (job, err) => {
    console.error(`❌ Alert job ${job?.id} failed:`, err);
});
