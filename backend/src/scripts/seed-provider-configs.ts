import { AppDataSource } from '../config/database';
import { Provider } from '../entities/Provider';
import { ProviderConfig, ConfigType } from '../entities/ProviderConfig';

async function seedProviderConfigs() {
    await AppDataSource.initialize();

    const providerRepo = AppDataSource.getRepository(Provider);
    const configRepo = AppDataSource.getRepository(ProviderConfig);

    console.log('🌱 Seeding provider configurations...');

    // Get providers
    const centerparcs = await providerRepo.findOne({ where: { code: 'centerparcs' } });
    const haven = await providerRepo.findOne({ where: { code: 'haven' } });
    const hoseasons = await providerRepo.findOne({ where: { code: 'hoseasons' } });

    if (!centerparcs || !haven || !hoseasons) {
        throw new Error('Providers not found. Run provider seed first.');
    }

    // Center Parcs Village Codes
    const cpVillages = [
        { key: 'woburn', value: 'WO' },
        { key: 'whinfell', value: 'WF' },
        { key: 'sherwood', value: 'SF' },
        { key: 'longleat', value: 'LF' },
        { key: 'elveden', value: 'EF' },
    ];

    for (const village of cpVillages) {
        const existing = await configRepo.findOne({
            where: {
                provider: { id: centerparcs.id },
                configType: ConfigType.VILLAGE,
                key: village.key
            }
        });

        if (!existing) {
            await configRepo.save(configRepo.create({
                provider: centerparcs,
                configType: ConfigType.VILLAGE,
                key: village.key,
                value: village.value,
                enabled: true
            }));
            console.log(`✅ Created Center Parcs village: ${village.key} → ${village.value}`);
        }
    }

    // Haven Park Codes (example - add actual codes)
    const havenParks = [
        { key: 'devon-cliffs', value: 'DEVON_CLIFFS' },
        { key: 'blue-anchor', value: 'BLUE_ANCHOR' },
        // Add more as needed
    ];

    for (const park of havenParks) {
        const existing = await configRepo.findOne({
            where: {
                provider: { id: haven.id },
                configType: ConfigType.PARK_CODE,
                key: park.key
            }
        });

        if (!existing) {
            await configRepo.save(configRepo.create({
                provider: haven,
                configType: ConfigType.PARK_CODE,
                key: park.key,
                value: park.value,
                enabled: true
            }));
            console.log(`✅ Created Haven park: ${park.key} → ${park.value}`);
        }
    }

    console.log('✅ Provider configuration seeding complete');
    await AppDataSource.destroy();
}

seedProviderConfigs().catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
});
