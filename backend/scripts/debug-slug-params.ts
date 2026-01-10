
import { chromium } from 'playwright';

const BASE = 'https://www.hoseasons.co.uk/holiday-parks';
const DATE_PARAMS = '?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

const SLUGS = [
    'cumbria',
    'lake-district',
    'south-west-of-england/cornwall' // Just testing nested too
];

async function run() {
    console.log('Verifying Holiday Parks Slugs with Params...');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        for (const slug of SLUGS) {
            const url = `${BASE}/${slug}${DATE_PARAMS}`;
            console.log(`\nTesting URL: ${url}`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // WAF/Cookie
                try {
                    const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
                    if (await acceptBtn.isVisible({ timeout: 4000 })) await acceptBtn.click();
                } catch { }

                await page.waitForTimeout(4000);

                const bodyText = await page.innerText('body');

                if (bodyText.includes("can't find the page")) {
                    console.log(`❌ 404 / Not Found for slug: ${slug}`);
                } else {
                    const title = await page.title();
                    console.log(`✅ Loaded. Title: ${title}`);

                    // Check headers
                    const resultText = await page.evaluate(() => {
                        const header = document.querySelector('h1, h2, h3, .card-header');
                        return header ? header.innerText.replace(/\n/g, ' ') : 'No Header';
                    });
                    console.log(`Page Header: ${resultText}`);

                    // Check result count
                    // "173 properties"
                    const countMatch = bodyText.match(/(\d+)\s+properties/);
                    if (countMatch) {
                        console.log(`Count: ${countMatch[0]}`);
                    } else {
                        console.log(`Count: Not found (or 0)`);
                    }

                    // Check specific location names
                    const sampleLocs = await page.evaluate(() => {
                        const items = [];
                        const elements = document.querySelectorAll('.card-header, h3, h4');
                        for (const el of elements) {
                            if (el.innerText.length > 5 && el.innerText.length < 50) items.push(el.innerText);
                        }
                        return items.slice(0, 3);
                    });
                    console.log('Sample headers:', sampleLocs);
                }

            } catch (e) {
                console.log(`Err: ${e.message}`);
            }
        }
    } finally {
        await browser.close();
    }
}

run();
