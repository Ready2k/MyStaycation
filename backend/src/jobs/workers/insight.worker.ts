import { Worker, Job } from 'bullmq';
import { AppDataSource } from '../../config/database';
import { insightService } from '../../services/insight.service';
import { InsightJobData } from '../queues';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import IORedis from 'ioredis';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);

async function processInsightJob(job: Job<InsightJobData>) {
    const { fingerprintId } = job.data;

    console.log(`🧠 Generating insights for fingerprint ${fingerprintId}`);

    try {
        // Generate insights
        const insights = await insightService.generateInsights(fingerprintId);

        if (insights.length === 0) {
            console.log(`ℹ️  No new insights generated for fingerprint ${fingerprintId}`);
            return;
        }

        console.log(`✅ Generated ${insights.length} insights for fingerprint ${fingerprintId}`);

        // Get the fingerprint to find the user
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['profile', 'profile.user'],
        });

        if (!fingerprint?.profile?.user) {
            console.warn(`⚠️  No user found for fingerprint ${fingerprintId}, skipping alerts`);
            return;
        }

        // Import addAlertJob dynamically to avoid circular dependency
        const { addAlertJob } = await import('../queues');

        // Queue alert jobs for each insight
        for (const insight of insights) {
            await addAlertJob({
                userId: fingerprint.profile.user.id,
                insightId: insight.id,
                profileId: fingerprint.profile.id,
            });
        }

        console.log(`📧 Queued ${insights.length} alert jobs`);

    } catch (error) {
        console.error(`❌ Insight generation failed for fingerprint ${fingerprintId}:`, error);
        throw error; // Let BullMQ handle retry
    }
}

export const insightWorker = new Worker('insights', processInsightJob, {
    connection,
    concurrency: 5, // Can process multiple fingerprints in parallel
});

insightWorker.on('completed', (job) => {
    console.log(`✅ Insight job ${job.id} completed`);
});

insightWorker.on('failed', (job, err) => {
    console.error(`❌ Insight job ${job?.id} failed:`, err);
});
