import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'staycation',
    password: process.env.POSTGRES_PASSWORD || 'staycation_dev',
    database: process.env.POSTGRES_DB || 'staycation_db',
};

async function checkDatabase() {
    console.log(`🔍 Checking database connection to ${config.host}:${config.port}...`);
    
    const client = new Client(config);
    
    try {
        await client.connect();
        console.log('✅ Database is reachable and accepting connections.');
        await client.end();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Database connection failed!');
        console.error(`   Error: ${error.message}`);
        console.error('\n💡 Troubleshooting:');
        console.log('   1. Is Docker running?');
        console.log('   2. Have you started the DB? Run: npm run db:test:up');
        console.log('   3. Is your .env configured correctly?');
        process.exit(1);
    }
}

checkDatabase();
