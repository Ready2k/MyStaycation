
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cumbria+%26+The+Lakes&start=01-09-2024&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Debugging Browser View...');

    // Explicitly launch headless=true unless you want to see it locally (which I can't here)
    // But I will save a screenshot.
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Minimal args
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        console.log(`Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log('Waiting for network idle or timeout...');
        try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch { }

        const title = await page.title();
        console.log(`Page Title: "${title}"`);

        // Screenshot
        await page.screenshot({ path: 'hoseasons_debug.png' });
        console.log('Saved screenshot to hoseasons_debug.png');

        // Dump HTML
        const html = await page.content();
        console.log(`HTML Length: ${html.length}`);

        // Simple check for blocking keywords
        if (html.includes('Access Denied') || html.includes('Cloudflare') || html.includes('Human Verification')) {
            console.log('⚠️  BLOCKING DETECTED in HTML content');
        }

    } catch (e) {
        console.error('Browser error:', e);
    } finally {
        await browser.close();
    }
}

run().catch(console.error);
