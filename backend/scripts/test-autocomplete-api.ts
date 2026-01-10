import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Testing Autocomplete API directly (Node context)...');

    // API Endpoint found from probe
    const baseUrl = 'https://location-lookup.api.prd.age.awaze.com/hoseasons/826';

    const terms = [
        'Devon',
        'Durham',
        'County Durham',
        'Kielder',
        'Northumberland'
    ];

    for (const term of terms) {
        console.log(`\n🧪 Testing Term: "${term}"`);
        const targetUrl = `${baseUrl}?term=${encodeURIComponent(term)}&accommodationType=holiday-parks&maxAutocompleteResults=10`;

        try {
            const res = await fetch(targetUrl, {
                headers: {
                    'Accept': 'application/json',
                    'x-awaze-brand': 'hoseasons',
                    'x-awaze-locale': 'en-gb',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://www.hoseasons.co.uk',
                    'Referer': 'https://www.hoseasons.co.uk/'
                }
            });

            if (!res.ok) {
                console.log(`   ❌ HTTP Error: ${res.status} ${res.statusText}`);
                const text = await res.text();
                // console.log('   Body:', text);
                continue;
            }

            const json = await res.json();

            if (Array.isArray(json)) {
                console.log(`   ✅ Status: ${res.status}`);
                console.log(`   📊 Found: ${json.length} results`);
                json.forEach((item: any) => {
                    console.log(`      - [${item.type}] ${item.name} (ID: ${item.id}, PlaceID: ${item.placeId})`);
                });
            } else {
                console.log(`   ❌ Unexpected response:`, JSON.stringify(json).slice(0, 100));
            }

        } catch (e) {
            console.log(`   ❌ Failed: ${e}`);
        }

    }
}

run();
