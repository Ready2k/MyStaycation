
import { AppDataSource } from '../src/config/database';
import { Provider } from '../src/entities/Provider';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(Provider);
    const providers = await repo.find();
    console.log('Providers:', JSON.stringify(providers, null, 2));
    await AppDataSource.destroy();
}

run().catch(console.error);
