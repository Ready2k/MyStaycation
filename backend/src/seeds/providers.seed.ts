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

    // Center Parcs
    let centerParcs = await providerRepo.findOne({ where: { code: 'centerparcs' } });
    if (!centerParcs) {
        centerParcs = providerRepo.create({
            code: 'centerparcs',
            name: 'Center Parcs',
            baseUrl: 'https://www.centerparcs.co.uk',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 1,
            notes: 'Premium forest holidays',
        });
        await providerRepo.save(centerParcs);
        console.log('✅ Created Center Parcs provider');
    }

    // Butlins
    let butlins = await providerRepo.findOne({ where: { code: 'butlins' } });
    if (!butlins) {
        butlins = providerRepo.create({
            code: 'butlins',
            name: 'Butlins',
            baseUrl: 'https://www.butlins.com',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 1,
            notes: 'Family seaside resorts',
        });
        await providerRepo.save(butlins);
        console.log('✅ Created Butlins provider');
    }

    // Parkdean
    let parkdean = await providerRepo.findOne({ where: { code: 'parkdean' } });
    if (!parkdean) {
        parkdean = providerRepo.create({
            code: 'parkdean',
            name: 'Parkdean Resorts',
            baseUrl: 'https://www.parkdeanresorts.co.uk',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 2,
            notes: 'Caravan and lodge holidays',
        });
        await providerRepo.save(parkdean);
        console.log('✅ Created Parkdean provider');
    }

    // Away Resorts
    let awayResorts = await providerRepo.findOne({ where: { code: 'awayresorts' } });
    if (!awayResorts) {
        awayResorts = providerRepo.create({
            code: 'awayresorts',
            name: 'Away Resorts',
            baseUrl: 'https://www.awayresorts.co.uk',
            enabled: true,
            checkFrequencyHours: 48,
            maxConcurrent: 2,
            notes: 'Unique holiday park experiences',
        });
        await providerRepo.save(awayResorts);
        console.log('✅ Created Away Resorts provider');
    }

    // Add Haven parks
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
            console.log(`✅ Created Haven park: ${parkData.name}`);
        }
    }

    // Add Center Parcs parks
    const cpParks = [
        { code: 'sherwood', name: 'Sherwood Forest', region: 'Nottinghamshire' },
        { code: 'elveden', name: 'Elveden Forest', region: 'Suffolk' },
        { code: 'longleat', name: 'Longleat Forest', region: 'Wiltshire' },
        { code: 'whinfell', name: 'Whinfell Forest', region: 'Cumbria' },
        { code: 'woburn', name: 'Woburn Forest', region: 'Bedfordshire' },
    ];

    for (const parkData of cpParks) {
        const existing = await parkRepo.findOne({
            where: { provider: { id: centerParcs.id }, providerParkCode: parkData.code },
        });

        if (!existing) {
            const park = parkRepo.create({
                provider: centerParcs,
                providerParkCode: parkData.code,
                name: parkData.name,
                region: parkData.region,
            });
            await parkRepo.save(park);
            console.log(`✅ Created CP park: ${parkData.name}`);
        }
    }

    console.log('✅ Provider seeding complete');
}
