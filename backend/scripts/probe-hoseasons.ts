
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import { SearchParams } from '../src/adapters/base.adapter';
import { AccommodationType } from '../src/entities/HolidayProfile';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const REGIONS_TO_PROBE = [
    'Kendal',
    'Cumbria',
    'Lake District',
    'The Lake District',
    'Cumbria & The Lakes',
    'Cornwall',
    'Devon'
];

async function run() {
    console.log('Probing Hoseasons Regions...');
    process.env.SCRAPING_ENABLED = 'true';
    process.env.PROVIDER_HOSEASONS_ENABLED = 'true';

    const adapter = new HoseasonsAdapter();

    for (const region of REGIONS_TO_PROBE) {
        console.log(`\nTesting region: "${region}"`);
        const params: SearchParams = {
            provider: 'hoseasons',
            party: { adults: 2, children: 0 },
            dateWindow: { start: '2024-09-01', end: '2024-09-08' },
            nights: { min: 3, max: 7 },
            accommodation: AccommodationType.ANY,
            peakTolerance: 'mixed',
            pets: false,
            minBedrooms: 1,
            region: region
        };

        try {
            const results = await adapter.search(params);
            console.log(`✅ Success: ${results.length} results for "${region}"`);
        } catch (e: any) {
            console.log(`❌ Failed: "${region}" - ${e.message || e}`);
        }

        // Wait a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
}

run().catch(console.error);
