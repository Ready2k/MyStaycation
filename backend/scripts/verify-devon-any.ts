
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    const adapter = new HoseasonsAdapter();
    const params = {
        provider: 'hoseasons',
        party: { adults: 2, children: 0 },
        dateWindow: { start: '2026-03-30', end: '2026-04-06' },
        nights: { min: 7, max: 7 },
        pets: false,
        minBedrooms: 0,
        region: 'Devon',
        metadata: { propertyType: 'Any' }, // TEST THIS SPECIFICALLY
        peakTolerance: 'mixed' as const,
    };

    // access protected method
    const url = (adapter as any).buildSearchUrl(params);
    console.log("Generated URL:", url);

    if (url.includes('accommodationType=anys')) {
        console.error("FAIL: generated 'anys'");
    } else if (url.includes('accommodationType=holiday-parks')) {
        console.log("SUCCESS: generated 'holiday-parks'");
    } else {
        console.log("WARN: generated something else");
    }
}
run();
