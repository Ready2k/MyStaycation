
import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Inspecting Hoseasons State for Devon ID...');
    const browser = await chromium.launch({ headless: true });
    // Testing hypothesis: User's URL path "/lodges/england/county-durham"
    const url = 'https://www.hoseasons.co.uk/lodges/england/county-durham';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

        console.log('⏳ Waiting for WAF challenge / Site load...');
        try {
            // Wait for the real site to render (bypass WAF)
            await page.waitForFunction(() => {
                const text = document.body.innerText;
                return text.includes('You control your data') || text.includes('Holiday Parks') || text.includes('Hoseasons');
            }, { timeout: 30000 });
            console.log('✅ Site loaded (WAF passed)');
            // Give it a bit more time for hydration
            await page.waitForTimeout(5000);
        } catch (e) {
            console.log('⚠️  WAF wait timeout or failure, attempting extraction anyway...');
        }


        // Extract Next.js Data
        const nextData = await page.evaluate(() => {
            return (window as any).__NEXT_DATA__;
        });

        if (nextData) {
            console.log('✅ Found __NEXT_DATA__');
            const props = nextData.props?.pageProps;

            if (props) {
                console.log('Existing Keys:', Object.keys(props));
                if (props.searchParams) console.log('SearchParams:', props.searchParams);

                const jsonStr = JSON.stringify(props);

                // Search for "placesId"
                const placesIdMatch = jsonStr.match(/"placesId"\s*:\s*"?(\d+)"?/);
                if (placesIdMatch) {
                    console.log('🎯 Found Potential placesId (from NextData):', placesIdMatch[1]);
                }

                // Search for "facetId"
                const facetIdMatch = jsonStr.match(/"facetId"\s*:\s*"?(\d+)"?/);
                if (facetIdMatch) {
                    console.log('🎯 Found Potential facetId (from NextData):', facetIdMatch[1]);
                }
            }
        }

        // Always scan raw HTML as backup (sometimes NextData is sparse)
        console.log('🔍 Scanning raw HTML for IDs...');
        const html = await page.content();

        // Search for known ID to identify context
        const idIndex = html.indexOf('39248');
        if (idIndex > -1) {
            console.log('✅ Found KNOWN ID 39248 in HTML. Context:', html.substring(idIndex - 100, idIndex + 100));
        } else {
            console.log('❌ Known ID 39248 NOT found in HTML.');
        }

        // Search for generic placesId pattern
        const placesIdMatches = [...html.matchAll(/"placesId"\s*[:=]\s*["']?(\d+)["']?/g)];
        if (placesIdMatches.length === 0) {
            console.log('❌ No placesId found. Dumping HTML for inspection...');
            require('node:fs').writeFileSync('county-durham.html', html);
        } else {
            console.log('🎯 HTML placesIds:', [...new Set(placesIdMatches.map(m => m[1]))]);
        }

        // Search for "facetId"
        const facetIdMatches = [...html.matchAll(/"facetId"\s*[:=]\s*["']?(\d+)["']?/g)];
        if (facetIdMatches.length > 0) {
            console.log('🎯 HTML facetIds:', [...new Set(facetIdMatches.map(m => m[1]))]);
        }

        // Search for "Devon" context
        const devonIndex = html.indexOf('"name":"Devon"');
        if (devonIndex > -1) {
            console.log('Excerpt around "name":"Devon":', html.substring(devonIndex - 100, devonIndex + 100));
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

run();
