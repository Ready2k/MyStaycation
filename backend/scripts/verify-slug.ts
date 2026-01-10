
import { chromium } from 'playwright';

const BASE = 'https://www.hoseasons.co.uk/lodges-holiday-parks';
const DATE_PARAMS = '?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

const SLUGS = [
    'cornwall',
    'northumberland',
    'kielder-water-and-bellingham'
];

async function run() {
    console.log('Verifying Region Slugs...');
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
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // WAF/Cookie
                try {
                    await page.waitForFunction(() => {
                        const text = document.body.innerText;
                        return text.includes('You control your data') || text.includes('Holiday Parks') || text.includes('Hoseasons');
                    }, { timeout: 15000 });

                    const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
                    if (await acceptBtn.isVisible({ timeout: 5000 })) await acceptBtn.click();
                } catch { }

                await page.waitForTimeout(5000); // Wait for load

                // Scrape headers
                const results = await page.evaluate(() => {
                    const items = [];
                    const elements = document.querySelectorAll('h3, h2, h4, .card-header');
                    for (const el of elements) {
                        const text = el.innerText;
                        if (text && text.length > 5 && text.length < 100) {
                            items.push(text.replace(/\n/g, ' '));
                        }
                    }
                    return items.slice(0, 15);
                });

                console.log(`Results for ${slug}:`);
                results.forEach(r => console.log(` - ${r}`));

                await page.screenshot({ path: `slug-${slug}.png` });
                const bodyText = await page.innerText('body');
                console.log(`Body text length: ${bodyText.length}`);
                if (bodyText.length < 1000) console.log('Body Text Snippet:', bodyText);

                // Check for "0 properties found"
                if (bodyText.includes('0 properties found') || bodyText.includes('No properties found')) {
                    console.log('❌ 0 Results found on page');
                }

            } catch (e) {
                console.error(`Failed ${slug}:`, e);
            }
        }

    } finally {
        await browser.close();
    }
}

run();
