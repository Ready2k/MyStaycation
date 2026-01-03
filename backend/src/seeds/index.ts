import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { initializeDatabase } from '../config/database';
import { seedProviders } from './providers.seed';

dotenv.config();

async function runSeeds() {
    try {
        console.log('🌱 Running database seeds...');

        await initializeDatabase();
        await seedProviders();

        console.log('✅ All seeds completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

runSeeds();
