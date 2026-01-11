
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { monitorQueue } from './jobs/queues';
import { redisConnection } from './config/redis';
import { AppDataSource } from './config/database';
import { SearchFingerprint } from './entities/SearchFingerprint';

dotenv.config();

async function trigger() {
    console.log('🔌 Connecting...');
    await AppDataSource.initialize();

    // Find the fingerprint for the user profile
    const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
    const fingerprint = await fingerprintRepo.findOne({
        where: { profile: { id: 'ee7c526f-bfad-4359-a6e6-732005ded367' } },
        relations: ['provider']
    });

    if (!fingerprint) {
        console.error('❌ Fingerprint not found for profile');
        process.exit(1);
    }

    console.log(`FOUND FINGERPRINT: ${fingerprint.id} (Provider: ${fingerprint.provider.code})`);

    // Construct job data
    const jobData = {
        fingerprintId: fingerprint.id,
        providerId: fingerprint.provider.id,
        searchParams: fingerprint.canonicalJson,
    };

    console.log('📊 Queue Status BEFORE add:', await monitorQueue.getJobCounts());

    // Add job with RANDOM ID to bypass idempotency
    const uniqueId = `manual-trigger-${Date.now()}`;
    console.log(`🚀 Adding job with ID: ${uniqueId}`);

    await monitorQueue.add('monitor-search', jobData, {
        jobId: uniqueId,
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100
    });

    console.log('✅ Job added to queue!');
    console.log('📊 Queue Status AFTER add:', await monitorQueue.getJobCounts());

    await redisConnection.quit();
    await AppDataSource.destroy();
}

trigger().catch(console.error);
