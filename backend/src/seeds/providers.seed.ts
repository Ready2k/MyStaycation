import { AppDataSource } from '../config/database';
import { Provider } from '../entities/Provider';
import { ProviderPark } from '../entities/ProviderPark';

const providerRepo = AppDataSource.getRepository(Provider);
const parkRepo = AppDataSource.getRepository(ProviderPark);

export async function seedProviders() {
    console.log('🌱 Seeding providers...');

    // Hoseasons
    let hoseasons = await providerRepo.findOne({ where: { code: 'hoseasons' } });
    if (!hoseasons) {
        hoseasons = providerRepo.create({
            code: 'hoseasons',
            name: 'Hoseasons',
            baseUrl: 'https://www.hoseasons.co.uk',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 2,
            notes: 'UK holiday parks and lodges',
        });
        await providerRepo.save(hoseasons);
        console.log('✅ Created Hoseasons provider');
    }

    // Haven
    let haven = await providerRepo.findOne({ where: { code: 'haven' } });
    if (!haven) {
        haven = providerRepo.create({
            code: 'haven',
            name: 'Haven',
            baseUrl: 'https://www.haven.com',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 2,
            notes: 'UK holiday parks',
        });
        await providerRepo.save(haven);
        console.log('✅ Created Haven provider');
    }

    // Add some example parks for Haven
    const havenParks = [
        { code: 'devon-cliffs', name: 'Devon Cliffs', region: 'Devon' },
        { code: 'thorpe-park', name: 'Thorpe Park', region: 'Lincolnshire' },
        { code: 'primrose-valley', name: 'Primrose Valley', region: 'Yorkshire' },
    ];

    for (const parkData of havenParks) {
        const existing = await parkRepo.findOne({
            where: { provider: { id: haven.id }, providerParkCode: parkData.code },
        });

        if (!existing) {
            const park = parkRepo.create({
                provider: haven,
                providerParkCode: parkData.code,
                name: parkData.name,
                region: parkData.region,
            });
            await parkRepo.save(park);
            console.log(`✅ Created park: ${parkData.name}`);
        }
    }

    console.log('✅ Provider seeding complete');
}
