
import { chromium } from 'playwright';

const URLS = [
    'https://www.hoseasons.co.uk/lodges-holiday-parks/cornwall',
    'https://www.hoseasons.co.uk/holiday-parks/cornwall',
    'https://www.hoseasons.co.uk/search?text=Cornwall&adult=2&nights=3',
    'https://www.hoseasons.co.uk/search?q=Cornwall&adult=2&nights=3',
    'https://www.hoseasons.co.uk/search?destination=Cornwall&adult=2&nights=3'
];

async function run() {
    console.log('Debugging URL variants...');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        for (const url of URLS) {
            console.log(`\nTesting: ${url}`);
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // WAF/Cookie (Simpler)
                try {
                    const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
                    if (await acceptBtn.isVisible({ timeout: 2000 })) await acceptBtn.click();
                } catch { }

                await page.waitForTimeout(3000);

                const bodyText = await page.innerText('body');
                if (bodyText.includes("can't find the page")) {
                    console.log('❌ 404 / Not Found');
                } else {
                    const title = await page.title();
                    console.log(`✅ Loaded. Title: ${title}`);

                    // Check first result
                    const resultText = await page.evaluate(() => {
                        const header = document.querySelector('h3, h2, .card-header');
                        return header ? header.innerText : 'No Header';
                    });
                    console.log(`First Header: ${resultText}`);

                    // Check if generic "Recommended"
                    if (bodyText.includes("Cleethorpes") || bodyText.includes("Ben Nevis")) {
                        console.log('⚠️  Likely Generic Results');
                    }
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
