import { AppDataSource } from '../config/database';

async function addProviderIdColumn() {
    await AppDataSource.initialize();

    console.log('🔧 Adding provider_id column to holiday_profiles...');

    await AppDataSource.query(`
        ALTER TABLE holiday_profiles 
        ADD COLUMN IF NOT EXISTS provider_id UUID;
    `);

    await AppDataSource.query(`
        ALTER TABLE holiday_profiles 
        ADD CONSTRAINT fk_holiday_profiles_provider 
        FOREIGN KEY (provider_id) 
        REFERENCES providers(id) 
        ON DELETE SET NULL;
    `);

    console.log('✅ Migration complete');
    await AppDataSource.destroy();
}

addProviderIdColumn().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
