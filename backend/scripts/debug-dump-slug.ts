
import { chromium } from 'playwright';
import * as fs from 'node:fs';

async function run() {
    console.log('📸 Dumping Hoseasons Slug Page...');
    const browser = await chromium.launch({ headless: true });
    const url = 'https://www.hoseasons.co.uk/holiday-parks/devon';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Save Screenshot
        await page.screenshot({ path: 'devon-slug.png', fullPage: true });
        console.log('✅ Saved devon-slug.png');

        // Save HTML
        const html = await page.content();
        fs.writeFileSync('devon-slug.html', html);
        console.log('✅ Saved devon-slug.html');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

run();
