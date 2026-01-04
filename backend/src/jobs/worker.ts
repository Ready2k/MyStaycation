import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { initializeDatabase } from '../config/database';
import { monitorWorker } from './workers/monitor.worker';
import { insightWorker } from './workers/insight.worker';
import { alertWorker } from './workers/alert.worker';
import { redisConnection } from '../config/redis';

dotenv.config();

async function startWorker() {
    try {
        console.log('🔧 Initializing worker...');

        // Initialize database
        await initializeDatabase();

        console.log('✅ Worker started and listening for jobs');
        console.log(`   - Monitor worker: ${monitorWorker.name}`);
        console.log(`   - Insight worker: ${insightWorker.name}`);
        console.log(`   - Alert worker: ${alertWorker.name}`);

        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('📴 SIGTERM received, closing workers...');
            await monitorWorker.close();
            await insightWorker.close();
            await alertWorker.close();
            await redisConnection.disconnect();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            console.log('📴 SIGINT received, closing workers...');
            await monitorWorker.close();
            await insightWorker.close();
            await alertWorker.close();
            await redisConnection.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Worker failed to start:', error);
        process.exit(1);
    }
}

startWorker();
