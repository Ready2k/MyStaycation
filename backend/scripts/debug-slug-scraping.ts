
import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Debugging Hoseasons Slug Page Scraping...');
    const browser = await chromium.launch({ headless: true });
    // Use the exact URL from the logs
    const url = 'https://www.hoseasons.co.uk/holiday-parks/devon?adult=2&start=23-03-2026&nights=7&range=0&page=1&sort=recommended&displayMode=LIST';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for potential client-side hydration or WAF
        await page.waitForTimeout(5000);

        console.log('✅ Page loaded');

        // Dump info
        const info = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('article, [class*="card"], [class*="Card"]'));
            return cards.map(c => {
                return {
                    html: c.outerHTML.slice(0, 300) + '...',
                    text: (c as HTMLElement).innerText.split('\n').join(' | '),
                    price: c.querySelector('[class*="price"], [class*="Price"]')?.textContent || 'No Price Class',
                    rawPrice: (c as HTMLElement).innerText.match(/£[\d,]+/) ? 'Found £' : 'No £'
                };
            }).slice(0, 5); // Just first 5
        });

        console.log('🔍 Found Cards:', JSON.stringify(info, null, 2));

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

run();
