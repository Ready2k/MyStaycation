
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    console.log('Debugging Hoseasons Response...');

    // URL from the previous failure log
    const url = 'https://www.hoseasons.co.uk/api/search/properties/list?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2024&page=1&sort=recommended&displayMode=LIST&index=search&accommodationTypes=&features=&siteFeatures=&searchEngineVersion=v2&brand=hoseasons';

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'x-awaze-locale': 'en-GB',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);

        const text = await response.text();
        console.log('--- Body Start ---');
        console.log(text.substring(0, 1000)); // Log first 1000 chars
        console.log('--- Body End ---');

    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

run().catch(console.error);
