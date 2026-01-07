
import { CenterParcsAdapter } from './adapters/centerparcs.adapter';

async function run() {
    const adapter = new CenterParcsAdapter();
    const params = {
        pets: false,
        party: { adults: 2, children: 0 },
        nights: { max: 7, min: 3 },
        region: 'Sherwood',
        provider: 'centerparcs',
        dateWindow: { end: '2026-06-15', start: '2026-06-12' },
        minBedrooms: 0,
        peakTolerance: 'MIXED'
    };

    console.log('Starting search...');
    try {
        const results = await adapter.search(params as any);
        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log('First result:', JSON.stringify(results[0], null, 2));
        } else {
            console.log('No results found (Sold Out or Failed Parsing).');
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

run();
