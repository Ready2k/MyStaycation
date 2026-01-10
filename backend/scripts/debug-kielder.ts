
import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Debugging Kielder Search...');
    const browser = await chromium.launch({ headless: true });

    // Base API URL
    const baseUrl = 'https://www.hoseasons.co.uk/api/search/properties/list';
    // Use proven headers/params from Devon fix
    const commonParams = 'adult=2&child=0&infant=0&pets=0&range=0&nights=7&start=23-03-2026&page=1&sort=recommended&displayMode=LIST&index=search&features=&siteFeatures=&searchEngineVersion=v2&brand=hoseasons';

    const scenarios = [
        { name: 'Northumberland ID (39023)', params: `placesId=39023&accommodationType=holiday-parks` },
        { name: 'Kielder + Northumberland ID', params: `regionName=Kielder&placesId=39023&accommodationType=holiday-parks` },
    ];

    try {
        const page = await browser.newPage();
        await page.goto('https://www.hoseasons.co.uk', { waitUntil: 'domcontentloaded' });

        // Wait for WAF
        try {
            await page.waitForFunction(() => document.body.innerText.includes('Hoseasons'), { timeout: 15000 });
        } catch { }

        for (const scenario of scenarios) {
            const fullUrl = `${baseUrl}?${commonParams}&${scenario.params}`;
            console.log(`\n🧪 Testing: ${scenario.name}`);

            try {
                const result = await page.evaluate(async (url) => {
                    const res = await fetch(url, {
                        headers: {
                            'x-awaze-locale': 'en-gb',
                            'x-awaze-brand': 'hoseasons',
                            'Accept': 'application/json'
                        }
                    });
                    const json = await res.json();
                    return {
                        status: res.status,
                        count: json.properties?.length || 0,
                        total: json.pagination?.total || json.totalCount || '??',
                        examples: json.properties?.slice(0, 5).map((p: any) => `${p.name} (${p.location})`) || []
                    };
                }, fullUrl);

                console.log(`   ✅ Status: ${result.status}`);
                console.log(`   📊 Count: ${result.count}`);
                console.log(`   📍 Examples:\n      - ${result.examples.join('\n      - ')}`);

            } catch (e) {
                console.log(`   ❌ Failed: ${e}`);
            }

            await page.waitForTimeout(1000);
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

run();
