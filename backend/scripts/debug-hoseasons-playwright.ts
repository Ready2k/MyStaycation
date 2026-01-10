
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const REGIONS = ['Cornwall', 'Kendal'];

// Helper to build SEARCH URL (not API)
function buildSearchUrl(region: string) {
    const params = new URLSearchParams();
    params.append('adult', '2');
    params.append('child', '0');
    params.append('infant', '0');
    params.append('pets', '0');
    params.append('range', '0');
    params.append('nights', '3');
    params.append('accommodationType', 'holiday-parks');
    params.append('regionName', region);
    params.append('start', '01-09-2024'); // DD-MM-YYYY
    params.append('page', '1');
    params.append('sort', 'recommended');
    params.append('displayMode', 'LIST');

    return `https://www.hoseasons.co.uk/search?${params.toString()}`;
}

async function run() {
    console.log('Debugging Hoseasons with Playwright (Search Page)...');

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        for (const region of REGIONS) {
            console.log(`\nTesting: ${region}`);
            const url = buildSearchUrl(region);
            console.log(`Navigating to: ${url}`);

            let interceptedData: any = null;

            // Setup interception similar to adapter
            page.on('response', async (response) => {
                const responseUrl = response.url();
                if (responseUrl.includes('/api/') || responseUrl.includes('properties')) {
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        try {
                            const json = await response.json();
                            if (json.properties || json.data?.properties) {
                                console.log(`🎯 Intercepted API response from: ${responseUrl}`);
                                interceptedData = json;
                            }
                        } catch { }
                    }
                }
            });

            try {
                // Navigate and wait for network activity
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for interception
                const maxWait = 10000;
                const start = Date.now();
                while (!interceptedData && (Date.now() - start < maxWait)) {
                    await page.waitForTimeout(500);
                }

                if (interceptedData) {
                    const props = interceptedData.properties || interceptedData.data?.properties || [];
                    console.log(`✅ Success: Found ${props.length} properties for ${region}`);
                } else {
                    console.log(`❌ No API data intercepted for ${region}`);
                    // Check if we are on a 404 page or similar
                    const title = await page.title();
                    console.log(`Page Title: ${title}`);
                }

            } catch (e) {
                console.error('Navigation failed:', e);
            }
        }

    } finally {
        await browser.close();
    }
}

run().catch(console.error);
