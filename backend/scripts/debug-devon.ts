
import { chromium } from 'playwright';

// Helper to wait for timeout
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testUrl(name: string, url: string) {
    console.log(`\n\n---------------------------------------`);
    console.log(`TESTING: ${name}`);
    console.log(`URL: ${url}`);
    console.log(`---------------------------------------`);

    const browser = await chromium.launch({ headless: true }); // Headless OK for simple check? WAF might block.
    // If WAF blocks, use headless: false or existing args.
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    let scrapedCount = 0;

    // Intercept API calls
    page.on('response', async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('/api/') && responseUrl.includes('search')) {
            console.log(`\n🎯 Network: ${responseUrl}`);
            try {
                const json = await response.json();
                if (json.properties) {
                    console.log(`   -> Returned ${json.properties.length} properties`);
                    console.log(`   -> First: ${json.properties[0]?.name} (${json.properties[0]?.regionName || json.properties[0]?.location})`);
                }
            } catch (e) { }
        }
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for potential WAF or loading
        await wait(5000);

        // Accept Cookies if present
        try {
            const cookieBtn = await page.getByRole('button', { name: 'Accept All' });
            if (await cookieBtn.isVisible()) {
                await cookieBtn.click();
                await wait(2000);
            }
        } catch (e) { }

        // Dump Title
        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // Try to scrape H3 headers (Strategy 2)
        const headers = await page.evaluate(() => {
            const h3s = Array.from(document.querySelectorAll('h3, h2')); // Property names are often here
            return h3s.map(h => (h as HTMLElement).innerText.trim()).filter(t => t.length > 0 && !t.includes('Filter') && !t.includes('Menu'));
        });

        // Try to find price
        const prices = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[data-test="price-value"], .price-text')).map(el => el.textContent);
        });

        // Filter valid-ish headers (simple check)
        const validProperties = headers.filter(h =>
            !h.includes('Holidays') &&
            !h.includes('Holiday Parks in') &&
            !h.includes('Sign in')
        );

        console.log(`Headers found (${headers.length}):`, headers.slice(0, 5));
        console.log(`Prices found (${prices.length}):`, prices.slice(0, 5));
        console.log(`Potential Properties (${validProperties.length}):`, validProperties.slice(0, 5));

        scrapedCount = validProperties.length;

    } catch (error) {
        console.error("Error testing URL:", error);
    } finally {
        await browser.close();
    }

    return scrapedCount;
}

async function run() {
    const commonParams = 'adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=lodges&start=30-03-2026';

    // 1. Current Slug Method
    await testUrl('Slug Method', `https://www.hoseasons.co.uk/holiday-parks/devon?${commonParams}`);

    // 2. Query Param ONLY
    await testUrl('Query Param Only', `https://www.hoseasons.co.uk/search?regionName=Devon&${commonParams}`);

    // 3. User URL (Query Param + ID)
    // Note: I don't know if placesId=39248 is static for devon, but let's test.
    await testUrl('User URL (with ID)', `https://www.hoseasons.co.uk/search?regionName=Devon&placesId=39248&${commonParams}`);
    // 4. Broken Accom Type?
    await testUrl('Broken Accom Type (anys)', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=anys&start=30-03-2026`);

    // 5. Test 'holiday-parks' specifically
    await testUrl('Test accommodationType=holiday-parks', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=holiday-parks&start=30-03-2026`);

    // 6. Test MISSING accommodationType
    await testUrl('Test MISSING accommodationType', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&start=30-03-2026`);

    // 7. Test EMPTY accommodationType
    await testUrl('Test EMPTY accommodationType', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=&start=30-03-2026`);

    // 8. Test 'parks' specifically
    await testUrl('Test accommodationType=parks', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=parks&start=30-03-2026`);

    // 9. Test 'lodges' again to confirm
    await testUrl('Test accommodationType=lodges (Confirm)', `https://www.hoseasons.co.uk/search?regionName=Devon&adult=2&child=0&infant=0&pets=0&range=0&nights=7&accommodationType=lodges&start=30-03-2026`);
}

run();
