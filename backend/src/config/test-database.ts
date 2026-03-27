import { DataSource } from 'typeorm';
import { ENTITIES } from '../entities';
import * as dotenv from 'dotenv';

dotenv.config();

export const createTestDataSource = () => {
    return new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        username: process.env.POSTGRES_USER || 'staycation',
        password: process.env.POSTGRES_PASSWORD || 'staycation_dev',
        database: process.env.POSTGRES_DB || 'staycation_db',
        synchronize: true, // Always sync for tests
        dropSchema: true,  // Fresh start
        entities: ENTITIES,
        logging: false,
    });
};
