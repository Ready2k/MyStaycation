
import { chromium } from 'playwright';
import path from 'path';

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2024&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Inspecting clientpagerender...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        page.on('response', async response => {
            const url = response.url();
            if (url.includes('clientpagerender')) {
                console.log(`🎯 Intercepted clientpagerender: ${response.status()}`);
                try {
                    const json = await response.json();
                    console.log('Keys:', Object.keys(json));
                    if (json.data && json.data.properties) {
                        console.log(`✅ Found visible properties: ${json.data.properties.length}`);
                    } else if (json.properties) {
                        console.log(`✅ Found properties: ${json.properties.length}`);
                    } else {
                        console.log('⚠️  No properties found in payload');
                        console.log(JSON.stringify(json).substring(0, 500));
                    }
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for WAF bypass
        await page.waitForFunction(() => {
            const text = document.body.innerText;
            return text.includes('You control your data') || text.includes('Holiday Parks');
        }, { timeout: 30000 });

        await page.waitForTimeout(10000);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
