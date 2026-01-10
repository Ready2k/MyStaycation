
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cumbria+%26+The+Lakes&start=01-09-2024&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Dumping HTML...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const html = await page.content();
        fs.writeFileSync('hoseasons_dump.html', html);
        console.log('Saved to hoseasons_dump.html');
    } catch (e) { console.error(e); }
    await browser.close();
}
run();
