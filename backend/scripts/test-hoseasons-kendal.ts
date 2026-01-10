
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import { SearchParams } from '../src/adapters/base.adapter';
import { AccommodationType } from '../src/entities/HolidayProfile';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    console.log('Testing Hoseasons Adapter with Kendal...');

    // Ensure scraping is enabled for test
    process.env.SCRAPING_ENABLED = 'true';
    process.env.PROVIDER_HOSEASONS_ENABLED = 'true';

    const adapter = new HoseasonsAdapter();

    const params: SearchParams = {
        provider: 'hoseasons',
        party: { adults: 2, children: 0 },
        // Use a date likely to have availability (e.g. 6 months out)
        dateWindow: { start: '2024-09-01', end: '2024-09-08' },
        nights: { min: 3, max: 7 },
        accommodation: AccommodationType.ANY,
        peakTolerance: 'mixed',
        pets: false,
        minBedrooms: 1,
        region: 'Kendal'
    };

    try {
        const results = await adapter.search(params);
        console.log(`Found ${results.length} results`);
        if (results.length === 0) {
            console.log('No results found. Please check logs for API URL.');
        } else {
            console.log('First result:', results[0]);
        }
    } catch (e) {
        console.error('Search failed:', e);
    }
}

run().catch(console.error);
