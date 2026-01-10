
import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Verifying API Parameters for Devon ID...');
    const browser = await chromium.launch({ headless: true });

    // Base API URL pattern from logs
    const baseUrl = 'https://www.hoseasons.co.uk/api/search/properties/list';
    // Full params from working log
    const commonParams = 'adult=2&child=0&infant=0&pets=0&range=0&nights=7&start=23-03-2026&page=1&sort=recommended&displayMode=LIST&index=search&features=&siteFeatures=&searchEngineVersion=v2&brand=hoseasons';

    // Test Cases
    const scenarios = [
        { name: 'Control (RegionName Only)', params: `regionName=Devon&accommodationType=holiday-parks` },
        { name: 'PlacesId=39248 Only', params: `placesId=39248&accommodationType=holiday-parks` }, // Try removing regionName?
        { name: 'PlacesId=39248 + Devon', params: `regionName=Devon&placesId=39248&accommodationType=holiday-parks` },
        { name: 'Region=21997 Only', params: `region=21997&accommodationType=holiday-parks` },
        { name: 'Region=21997 + Devon', params: `regionName=Devon&region=21997&accommodationType=holiday-parks` },
        { name: 'Everything', params: `regionName=Devon&region=21997&placesId=39248&accommodationType=holiday-parks` }
    ];

    try {
        const page = await browser.newPage();
        // Go to home first to get cookies/waf
        await page.goto('https://www.hoseasons.co.uk', { waitUntil: 'domcontentloaded' });

        console.log('⏳ Waiting for WAF...');
        try {
            await page.waitForFunction(() => document.body.innerText.includes('Hoseasons'), { timeout: 30000 });
        } catch { }

        for (const scenario of scenarios) {
            const fullUrl = `${baseUrl}?${commonParams}&${scenario.params}`;
            console.log(`\n🧪 Testing: ${scenario.name}`);
            // console.log(`   URL: ${url}`); // verbose

            try {
                // Use fetch inside the page to set headers
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
                        // Try various total count locations
                        total: json.pagination?.total || json.totalCount || json.facet?.find((f: any) => f.name === 'count')?.value || '??',
                        // Return first 5 names/locs
                        examples: json.properties?.slice(0, 5).map((p: any) => `${p.name} (${p.location})`) || []
                    };
                }, fullUrl);

                console.log(`   ✅ Status: ${result.status}`);
                console.log(`   📊 Properties in Page: ${result.count}`);
                console.log(`   🔢 Total Found: ${result.total}`);
                console.log(`   📍 Examples:\n      - ${result.examples.join('\n      - ')}`);

                // Helper to check if Devon
                const devonCount = result.examples.filter((s: string) => s.includes('Devon') || s.includes('Axminster') || s.includes('Exeter') || s.includes('Torquay')).length; // Common Devon towns
                if (devonCount > 0) console.log(`   ✅ Matched ${devonCount}/5 as likely Devon`);
                else console.log('   ❌ No obvious Devon matches');


            } catch (e) {
                console.log(`   ❌ Failed to fetch/parse: ${e}`);
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
