
import { HoseasonsAdapter } from '../src/adapters/hoseasons.adapter';
import { SearchParams } from '../src/adapters/base.adapter';

async function run() {
    console.log('🚀 Verifying Dynamic Region Search for "County Durham"...');

    // Instantiate adapter
    const adapter = new HoseasonsAdapter();

    // Validate config
    if (!process.env.HOSEASONS_BASE_URL) process.env.HOSEASONS_BASE_URL = 'https://www.hoseasons.co.uk';
    process.env.PLAYWRIGHT_ENABLED = 'true';

    const params: SearchParams = {
        region: 'County Durham',
        dateWindow: { start: '2025-05-01', end: '2025-05-08' }, // Future date
        nights: { min: 7, max: 7 },
        party: { adults: 2, children: 0 },
        pets: false,
        metadata: { propertyType: 'Lodges' },
        provider: 'hoseasons',
        peakTolerance: 0,
        minBedrooms: 2
    };

    try {
        const results = await adapter.search(params);
        console.log(`\n✅ Search Completed!`);
        console.log(`📊 Total Results: ${results.length}`);

        if (results.length > 0) {
            console.log('📝 Sample Results:');
            results.slice(0, 3).forEach(r => {
                console.log(`   - ${r.propertyName} (${r.location}) - £${r.priceTotalGbp}`);
            });
        } else {
            console.log('❌ No results found. Check logs for resolution failure.');
        }

    } catch (e) {
        console.error('❌ Search Failed:', e);
    }
}

run();
