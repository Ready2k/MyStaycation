
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import { SearchParams } from '../src/adapters/base.adapter';
import { AccommodationType } from '../src/entities/HolidayProfile';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const REGIONS = ['Kendal', 'Cornwall'];

async function run() {
    console.log('Verifying Hoseasons Adapter...');

    // Enable for test
    process.env.SCRAPING_ENABLED = 'true';
    process.env.PROVIDER_HOSEASONS_ENABLED = 'true';
    process.env.PLAYWRIGHT_ENABLED = 'true';

    const adapter = new HoseasonsAdapter();

    for (const region of REGIONS) {
        console.log(`\n-----------------------------------`);
        console.log(`Testing Region: "${region}"`);
        console.log(`-----------------------------------`);

        const params: SearchParams = {
            provider: 'hoseasons',
            party: { adults: 2, children: 0 },
            dateWindow: { start: new Date('2026-09-01'), end: new Date('2026-09-08') }, // Use valid future dates
            nights: { min: 3, max: 7 },
            accommodation: AccommodationType.ANY,
            peakTolerance: 'mixed',
            pets: false,
            minBedrooms: 1,
            region: region
        };

        try {
            const results = await adapter.search(params);

            if (results.length > 0) {
                console.log(`✅ SUCCESS: Found ${results.length} results for "${region}".`);
                console.log('Sample result:', {
                    name: results[0].propertyName,
                    price: results[0].priceTotalGbp,
                    location: results[0].location,
                    link: results[0].sourceUrl
                });
            } else {
                console.log(`❌ FAILURE: No results found for "${region}".`);
            }
        } catch (e: any) {
            console.error(`💥 CRASH: Search failed for "${region}":`, e);
        }
    }

    // Give browser time to close if needed
    await adapter.cleanup();
}

run().catch(console.error);
