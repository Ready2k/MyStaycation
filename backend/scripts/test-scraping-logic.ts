
import { chromium } from 'playwright';
import fs from 'fs';

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Testing Scraping Logic...');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for WAF / Load
        await page.waitForFunction(() => document.body.innerText.includes('properties found') || document.body.innerText.includes('Holiday Park'), { timeout: 30000 });

        // Wait for results to render
        await page.waitForTimeout(5000);

        // Scraping Logic
        const results = await page.evaluate(() => {
            const cards = [];
            // Find all elements that contain "nights" and "£"
            // Start with leaf nodes containing £
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            const priceNodes = [];
            while (node = walker.nextNode()) {
                if (node.textContent?.includes('£') && node.textContent && /\d/.test(node.textContent)) {
                    priceNodes.push(node.parentElement);
                }
            }

            // For each price node, walk up to find a container that has "nights" and an Image
            const seenContainers = new Set();

            for (const priceEl of priceNodes) {
                let container = priceEl;
                let depth = 0;
                while (container && container !== document.body && depth < 10) {
                    if (seenContainers.has(container)) break;

                    const text = container.innerText || '';
                    if (text.includes('nights') && (text.includes('out of') || text.includes('Sleeps') || text.includes('Bedrooms'))) {
                        // Found a likely card
                        seenContainers.add(container);

                        // Extract details
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                        const priceMatch = text.match(/£([\d,]+)/g);
                        const price = priceMatch ? priceMatch[priceMatch.length - 1] : '0'; // Take last price (often the discounted one)

                        // Name is usually the line with "Holiday Park" or big text?
                        // Simple heuristic: First line that isn't "1/12" or Location
                        let name = lines.find(l => l.includes('Holiday') || l.includes('Park') || l.includes('Lodge')) || lines[2];

                        cards.push({
                            name: name,
                            price: price,
                            fullText: text.substring(0, 200)
                        });
                        break;
                    }
                    container = container.parentElement;
                    depth++;
                }
            }
            return cards;
        });

        console.log(`Extracted ${results.length} cards`);
        console.log(JSON.stringify(results.slice(0, 3), null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
