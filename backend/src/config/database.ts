import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ENTITIES, User } from '../entities';

dotenv.config();

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    username: process.env.POSTGRES_USER || (isProduction ? undefined : 'staycation'),
    password: process.env.POSTGRES_PASSWORD || (isProduction ? undefined : 'staycation_dev'),
    database: process.env.POSTGRES_DB || (isProduction ? undefined : 'staycation_db'),
    synchronize: process.env.DB_SYNCHRONIZE === 'true', // Use carefully in production!
    logging: process.env.NODE_ENV === 'development',
    entities: ENTITIES,
    migrations: [path.join(process.cwd(), 'src/migrations/**/*.{ts,js}')],
    subscribers: [],
    // Allow explicit disabling of SSL via env var, otherwise default to true in production
    ssl: process.env.DB_SSL === 'false' ? false : (isProduction ? { rejectUnauthorized: false } : false),
});


export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established');

        if (process.env.RUN_MIGRATIONS === 'true') {
            console.log('🔄 Running migrations...');
            const migrations = await AppDataSource.runMigrations();
            console.log(`✅ ${migrations.length} migrations completed`);
        } else {
            console.log('ℹ️ Migrations skipped (RUN_MIGRATIONS not true)');
        }
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};
