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

    // Add Butlins resorts (3 fixed UK resorts)
    const butlinsParks = [
        { code: 'BG', name: 'Bognor Regis', region: 'West Sussex' },
        { code: 'MH', name: 'Minehead', region: 'Somerset' },
        { code: 'SK', name: 'Skegness', region: 'Lincolnshire' },
    ];

    for (const parkData of butlinsParks) {
        const existing = await parkRepo.findOne({
            where: { provider: { id: butlins.id }, providerParkCode: parkData.code },
        });

        if (!existing) {
            const park = parkRepo.create({
                provider: butlins,
                providerParkCode: parkData.code,
                name: parkData.name,
                region: parkData.region,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Butlins resort: ${parkData.name}`);
        }
    }

    // Add Away Resorts (unique resorts from adapter)
    const awayResortsParks = [
        { code: '7',  name: 'Tattershall Lakes',   region: 'Lincolnshire' },
        { code: '1',  name: 'Sandy Balls',          region: 'Hampshire' },
        { code: '18', name: 'Mill Rythe',           region: 'Hampshire' },
        { code: '15', name: 'Whitecliff Bay',       region: 'Isle of Wight' },
        { code: '12', name: 'Mersea Island',        region: 'Essex' },
        { code: '20', name: 'Barmouth Bay',         region: 'Wales' },
        { code: '17', name: "Cleethorpes Pearl",    region: 'Lincolnshire' },
        { code: '21', name: 'Golden Sands',         region: 'Lincolnshire' },
        { code: '23', name: 'St Ives Bay',          region: 'Cornwall' },
        { code: '24', name: 'Newquay Bay',          region: 'Cornwall' },
        { code: '19', name: 'Retallack',            region: 'Cornwall' },
        { code: '13', name: 'The Lakes Rookley',    region: 'Isle of Wight' },
        { code: '14', name: 'The Bay Colwell',      region: 'Isle of Wight' },
        { code: '26', name: 'Boston West',          region: 'Lincolnshire' },
        { code: '27', name: 'East Fleet',           region: 'Dorset' },
        { code: '28', name: 'Glendorgal',           region: 'Cornwall' },
        { code: '25', name: 'Gara Rock',            region: 'Devon' },
    ];

    for (const parkData of awayResortsParks) {
        const existing = await parkRepo.findOne({
            where: { provider: { id: awayResorts.id }, providerParkCode: parkData.code },
        });

        if (!existing) {
            const park = parkRepo.create({
                provider: awayResorts,
                providerParkCode: parkData.code,
                name: parkData.name,
                region: parkData.region,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Away Resorts park: ${parkData.name}`);
        }
    }

    // Add well-known Parkdean Resorts parks
    const parkdeanParks = [
        { code: 'riviere-sands',    name: 'Riviere Sands',    region: 'Cornwall' },
        { code: 'ruda',             name: 'Ruda',             region: 'Devon' },
        { code: 'weymouth-bay',     name: 'Weymouth Bay',     region: 'Dorset' },
        { code: 'trecco-bay',       name: 'Trecco Bay',       region: 'Wales' },
        { code: 'pendine-sands',    name: 'Pendine Sands',    region: 'Wales' },
        { code: 'craig-tara',       name: 'Craig Tara',       region: 'Scotland' },
        { code: 'sundrum-castle',   name: 'Sundrum Castle',   region: 'Scotland' },
        { code: 'st-minver',        name: 'St Minver',        region: 'Cornwall' },
        { code: 'newquay-holiday-park', name: 'Newquay Holiday Park', region: 'Cornwall' },
        { code: 'sandford',         name: 'Sandford',         region: 'Devon' },
    ];

    for (const parkData of parkdeanParks) {
        const existing = await parkRepo.findOne({
            where: { provider: { id: parkdean.id }, providerParkCode: parkData.code },
        });

        if (!existing) {
            const park = parkRepo.create({
                provider: parkdean,
                providerParkCode: parkData.code,
                name: parkData.name,
                region: parkData.region,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Parkdean park: ${parkData.name}`);
        }
    }

    console.log('✅ Provider seeding complete');
}
