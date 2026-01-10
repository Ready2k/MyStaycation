
import { chromium } from 'playwright';

const BASE = 'https://www.hoseasons.co.uk/holiday-parks';
const SLUGS = [
    'norfolk',
    'east-of-england/norfolk',
    'the-broads',
    'great-yarmouth'
];

async function run() {
    console.log('Verifying Norfolk Slugs...');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        for (const slug of SLUGS) {
            const url = `${BASE}/${slug}`;
            console.log(`\nTesting URL: ${url}`);

            try {
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const status = response?.status();
                console.log(`Status: ${status}`);

                if (status === 404) {
                    console.log('❌ 404 Not Found');
                    continue;
                }

                // Check title
                const title = await page.title();
                console.log(`Title: ${title}`);

                // Check header
                const header = await page.evaluate(() => {
                    const h1 = document.querySelector('h1');
                    return h1 ? h1.innerText : 'No H1';
                });
                console.log(`Header: ${header}`);

                // Screenshot for sanity
                if (slug === 'norfolk') {
                    await page.screenshot({ path: 'norfolk-test.png' });
                }

            } catch (e: any) {
                console.log(`Err: ${e.message}`);
            }
        }
    } finally {
        await browser.close();
    }
}

run();
