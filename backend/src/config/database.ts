import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    username: process.env.POSTGRES_USER || 'staycation',
    password: process.env.POSTGRES_PASSWORD || 'staycation_dev',
    database: process.env.POSTGRES_DB || 'staycation_db',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    entities: ['src/entities/**/*.ts'],
    migrations: ['src/migrations/**/*.ts'],
    subscribers: [],
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established');

        if (process.env.NODE_ENV === 'development') {
            await AppDataSource.runMigrations();
            console.log('✅ Migrations completed');
        }
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};
