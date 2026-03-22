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
        { code: 'devon-cliffs',    name: 'Devon Cliffs',    region: 'Devon',        latitude: 50.6333, longitude: -3.3167 },
        { code: 'thorpe-park',     name: 'Thorpe Park',     region: 'Lincolnshire', latitude: 53.5240, longitude: -0.0530 },
        { code: 'primrose-valley', name: 'Primrose Valley', region: 'Yorkshire',    latitude: 54.1467, longitude: -0.3267 },
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
                latitude: parkData.latitude,
                longitude: parkData.longitude,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Haven park: ${parkData.name}`);
        } else if (!existing.latitude) {
            await parkRepo.update(existing.id, { latitude: parkData.latitude, longitude: parkData.longitude });
            console.log(`✅ Updated coordinates for Haven park: ${parkData.name}`);
        }
    }

    // Add Center Parcs parks
    const cpParks = [
        { code: 'sherwood', name: 'Sherwood Forest', region: 'Nottinghamshire', latitude: 53.1648, longitude: -1.0668 },
        { code: 'elveden',  name: 'Elveden Forest',  region: 'Suffolk',          latitude: 52.3958, longitude:  0.6575 },
        { code: 'longleat', name: 'Longleat Forest', region: 'Wiltshire',        latitude: 51.1833, longitude: -2.2833 },
        { code: 'whinfell', name: 'Whinfell Forest', region: 'Cumbria',          latitude: 54.6383, longitude: -2.5477 },
        { code: 'woburn',   name: 'Woburn Forest',   region: 'Bedfordshire',     latitude: 52.0100, longitude: -0.5700 },
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
                latitude: parkData.latitude,
                longitude: parkData.longitude,
            });
            await parkRepo.save(park);
            console.log(`✅ Created CP park: ${parkData.name}`);
        } else if (!existing.latitude) {
            await parkRepo.update(existing.id, { latitude: parkData.latitude, longitude: parkData.longitude });
            console.log(`✅ Updated coordinates for CP park: ${parkData.name}`);
        }
    }

    // Add Butlins resorts (3 fixed UK resorts)
    const butlinsParks = [
        { code: 'BG', name: 'Bognor Regis', region: 'West Sussex',   latitude: 50.7853, longitude: -0.6757 },
        { code: 'MH', name: 'Minehead',     region: 'Somerset',      latitude: 51.2027, longitude: -3.4748 },
        { code: 'SK', name: 'Skegness',     region: 'Lincolnshire',  latitude: 53.1453, longitude:  0.3335 },
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
                latitude: parkData.latitude,
                longitude: parkData.longitude,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Butlins resort: ${parkData.name}`);
        } else if (!existing.latitude) {
            await parkRepo.update(existing.id, { latitude: parkData.latitude, longitude: parkData.longitude });
            console.log(`✅ Updated coordinates for Butlins resort: ${parkData.name}`);
        }
    }

    // Add Away Resorts (unique resorts from adapter)
    const awayResortsParks = [
        { code: '7',  name: 'Tattershall Lakes',   region: 'Lincolnshire',   latitude: 53.0817, longitude: -0.1942 },
        { code: '1',  name: 'Sandy Balls',          region: 'Hampshire',      latitude: 50.9338, longitude: -1.7787 },
        { code: '18', name: 'Mill Rythe',           region: 'Hampshire',      latitude: 50.7167, longitude: -1.0167 },
        { code: '15', name: 'Whitecliff Bay',       region: 'Isle of Wight',  latitude: 50.6478, longitude: -1.1167 },
        { code: '12', name: 'Mersea Island',        region: 'Essex',          latitude: 51.7833, longitude:  0.9167 },
        { code: '20', name: 'Barmouth Bay',         region: 'Wales',          latitude: 52.7178, longitude: -4.0469 },
        { code: '17', name: 'Cleethorpes Pearl',    region: 'Lincolnshire',   latitude: 53.5560, longitude: -0.0347 },
        { code: '21', name: 'Golden Sands',         region: 'Lincolnshire',   latitude: 53.3760, longitude:  0.2270 },
        { code: '23', name: 'St Ives Bay',          region: 'Cornwall',       latitude: 50.2181, longitude: -5.4804 },
        { code: '24', name: 'Newquay Bay',          region: 'Cornwall',       latitude: 50.4060, longitude: -5.0810 },
        { code: '19', name: 'Retallack',            region: 'Cornwall',       latitude: 50.4467, longitude: -4.9800 },
        { code: '13', name: 'The Lakes Rookley',    region: 'Isle of Wight',  latitude: 50.6333, longitude: -1.2833 },
        { code: '14', name: 'The Bay Colwell',      region: 'Isle of Wight',  latitude: 50.6833, longitude: -1.5333 },
        { code: '26', name: 'Boston West',          region: 'Lincolnshire',   latitude: 52.9760, longitude: -0.0280 },
        { code: '27', name: 'East Fleet',           region: 'Dorset',         latitude: 50.6133, longitude: -2.5667 },
        { code: '28', name: 'Glendorgal',           region: 'Cornwall',       latitude: 50.4267, longitude: -5.0600 },
        { code: '25', name: 'Gara Rock',            region: 'Devon',          latitude: 50.2300, longitude: -3.7967 },
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
                latitude: parkData.latitude,
                longitude: parkData.longitude,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Away Resorts park: ${parkData.name}`);
        } else if (!existing.latitude) {
            await parkRepo.update(existing.id, { latitude: parkData.latitude, longitude: parkData.longitude });
            console.log(`✅ Updated coordinates for Away Resorts park: ${parkData.name}`);
        }
    }

    // Add well-known Parkdean Resorts parks
    const parkdeanParks = [
        { code: 'riviere-sands',        name: 'Riviere Sands',        region: 'Cornwall',  latitude: 50.1400, longitude: -5.3000 },
        { code: 'ruda',                 name: 'Ruda',                 region: 'Devon',     latitude: 51.0890, longitude: -4.2610 },
        { code: 'weymouth-bay',         name: 'Weymouth Bay',         region: 'Dorset',    latitude: 50.5903, longitude: -2.4306 },
        { code: 'trecco-bay',           name: 'Trecco Bay',           region: 'Wales',     latitude: 51.4667, longitude: -3.7167 },
        { code: 'pendine-sands',        name: 'Pendine Sands',        region: 'Wales',     latitude: 51.7667, longitude: -4.5667 },
        { code: 'craig-tara',           name: 'Craig Tara',           region: 'Scotland',  latitude: 55.4667, longitude: -4.6333 },
        { code: 'sundrum-castle',       name: 'Sundrum Castle',       region: 'Scotland',  latitude: 55.4833, longitude: -4.4667 },
        { code: 'st-minver',            name: 'St Minver',            region: 'Cornwall',  latitude: 50.5500, longitude: -4.9167 },
        { code: 'newquay-holiday-park', name: 'Newquay Holiday Park', region: 'Cornwall',  latitude: 50.4130, longitude: -5.0800 },
        { code: 'sandford',             name: 'Sandford',             region: 'Devon',     latitude: 51.0610, longitude: -4.2590 },
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
                latitude: parkData.latitude,
                longitude: parkData.longitude,
            });
            await parkRepo.save(park);
            console.log(`✅ Created Parkdean park: ${parkData.name}`);
        } else if (!existing.latitude) {
            await parkRepo.update(existing.id, { latitude: parkData.latitude, longitude: parkData.longitude });
            console.log(`✅ Updated coordinates for Parkdean park: ${parkData.name}`);
        }
    }

    console.log('✅ Provider seeding complete');
}
