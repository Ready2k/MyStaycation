
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import { SearchParams } from '../src/adapters/base.adapter';
import { AccommodationType } from '../src/entities/HolidayProfile';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const REGIONS = ['Norfolk'];

async function run() {
    console.log(`Verifying Hoseasons Adapter...`);

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
            dateWindow: { start: '2026-09-01', end: '2026-09-08' } as any, // Cast to any to bypass strict type check for now if interface expects string|Date mismatch
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
                console.log('Locations found (First 5):');
                results.slice(0, 5).forEach(r => {
                    console.log(` - Name: ${r.propertyName}`);
                    console.log(`   Location: ${r.location}`);
                    console.log(`   Price: £${r.priceTotalGbp}`);
                    console.log(`   DeepLink: ${r.sourceUrl}`);
                    console.log(`   Confidence: ${r.matchConfidence}`);
                });

                // Check relevance
                const relevant = results.filter(r =>
                    (r.location && (r.location.toLowerCase().includes(region.toLowerCase()) || r.location.toLowerCase().includes('kielder') || r.location.toLowerCase().includes('northumberland') || r.location.toLowerCase().includes('cornwall')))
                );

                if (relevant.length > 0) {
                    console.log(`✅ Found ${relevant.length} RELEVANT results.`);
                } else {
                    console.log(`❌ WARNING: Results do not appear to match "${region}". Search might be defaulting to generic recommendations.`);
                }

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
