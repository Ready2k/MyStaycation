
import { chromium } from 'playwright';
import path from 'path';

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2024&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Logging Network Traffic...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        page.on('response', response => {
            const type = response.headers()['content-type'] || '';
            const url = response.url();

            // Log JSON responses or interesting API-like URLs
            if (type.includes('json') || url.includes('/api/')) {
                console.log(`[${response.status()}] ${type} - ${url}`);
                if (url.includes('search') || url.includes('properties')) {
                    // Peek at size
                    response.body().then(b => console.log(`   -> Size: ${b.length} bytes`)).catch(() => { });
                }
            }
        });

        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for WAF bypass
        try {
            await page.waitForFunction(() => {
                const text = document.body.innerText;
                return text.includes('You control your data') || text.includes('Holiday Parks');
            }, { timeout: 30000 });
            console.log('✅ WAF Bypassed');

            // Wait a bit more for background requests
            await page.waitForTimeout(10000);

        } catch (e) {
            console.log('Timeout waiting for content');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
