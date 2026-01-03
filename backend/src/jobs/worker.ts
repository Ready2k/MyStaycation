import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { initializeDatabase } from '../config/database';
import { monitorWorker } from './workers/monitor.worker';

dotenv.config();

async function startWorker() {
    try {
        console.log('🔧 Initializing worker...');

        // Initialize database
        await initializeDatabase();

        console.log('✅ Worker started and listening for jobs');
        console.log(`   - Monitor worker: ${monitorWorker.name}`);

        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('📴 SIGTERM received, closing worker...');
            await monitorWorker.close();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            console.log('📴 SIGINT received, closing worker...');
            await monitorWorker.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Worker failed to start:', error);
        process.exit(1);
    }
}

startWorker();
