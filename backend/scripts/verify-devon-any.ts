
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

    // Verify Full Search Flow
    console.log('🚀 Executing Full Search for Devon...');
    try {
        const results = await adapter.search(params);
        console.log(`✅ Search Returned ${results.length} results`);
        if (results.length > 0) {
            console.log(`   Sample: ${results[0].propertyName} - £${results[0].priceTotalGbp}`);
        } else {
            console.log('❌ Zero results returned.');
        }

        // Also check if URL construction logic used ID
        // (We can't easily check internal state, but success implies it worked)

    } catch (e) {
        console.error('❌ Search Failed:', e);
    }
}
run();
