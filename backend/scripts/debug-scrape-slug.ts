
import { chromium } from 'playwright';
import fs from 'fs';

const URL_TEST = 'https://www.hoseasons.co.uk/holiday-parks/cornwall?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Debugging Scraping on Slug Page...');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        console.log(`Navigating to: ${URL_TEST}`);
        await page.goto(URL_TEST, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // WAF/Cookie
        try {
            const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
            if (await acceptBtn.isVisible({ timeout: 4000 })) await acceptBtn.click();
        } catch { }

        await page.waitForTimeout(5000);

        // Dump info
        const result = await page.evaluate(() => {
            // Find any element with £ and digit
            const priceElements = [];
            const walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walkers.nextNode()) {
                if (node.textContent && node.textContent.includes('£')) {
                    priceElements.push(node.parentElement);
                }
            }

            // Get header texts
            const headers = Array.from(document.querySelectorAll('h3, .card-header')).slice(0, 5).map(el => el.textContent);

            // Try to find a card container
            let bestCard = null;
            for (const el of priceElements) {
                // walk up
                let p = el;
                let depth = 0;
                while (p && p !== document.body && depth < 8) {
                    const t = p.textContent || '';
                    if (t.toLowerCase().includes('bedroom') || t.toLowerCase().includes('sleeps')) {
                        bestCard = { html: p.outerHTML, text: p.innerText };
                        break;
                    }
                    p = p.parentElement;
                    depth++;
                }
                if (bestCard) break;
            }

            return { headers, bestCard };
        });

        console.log('Headers found:', result.headers);
        if (result.bestCard) {
            console.log('Found Card Text Sample:\n', result.bestCard.text.substring(0, 200) + '...');
            fs.writeFileSync('slug_card.html', result.bestCard.html);
        } else {
            console.log('❌ Could not find a price card with expected text');
        }

    } finally {
        await browser.close();
    }
}

run();
