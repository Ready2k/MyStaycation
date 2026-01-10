
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Inspecting DOM for Selectors...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // WAF Bypass
        await page.waitForFunction(() => {
            const text = document.body.innerText;
            return text.includes('You control your data') || text.includes('Holiday Parks');
        }, { timeout: 30000 });

        // Wait for results
        await page.waitForTimeout(5000);

        // Find elements with price (£)
        const priceElements = await page.evaluate(() => {
            const hits = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('£') && /\d/.test(node.textContent)) {
                    const parent = node.parentElement;
                    // Go up 3-4 levels to find a likely container
                    let container = parent;
                    let path = [];
                    for (let i = 0; i < 4; i++) {
                        if (container) {
                            path.push(`${container.tagName}.${container.className}`);
                            container = container.parentElement;
                        }
                    }

                    hits.push({
                        text: node.textContent.trim(),
                        parentTag: parent.tagName,
                        parentClass: parent.className,
                        path: path.join(' > '),
                        fullTextStart: parent.innerText.substring(0, 50).replace(/\n/g, ' ')
                    });
                }
            }
            return hits;
        });

        console.log('Price Elements Found:', JSON.stringify(priceElements, null, 2));

        // Evaluate to find potential card containers
        const cardInfo = await page.evaluate(() => {
            const potentialCards = [];

            // Look for elements that look like property cards
            // Strategy: Find price, go up to a container that has an image and a title
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('£') && /\d/.test(node.textContent)) {
                    // This is a price node
                    let container = node.parentElement;
                    while (container && container !== document.body) {
                        // Check if this container looks like a card
                        // Has Image? Has Title?
                        const hasImg = container.querySelector('img');
                        const hasLink = container.querySelector('a');
                        const text = container.innerText;

                        // Heuristic: Has "nights" or "Sleeps"
                        if (hasImg && hasLink && (text.includes('Sleeps') || text.includes('Bedrooms'))) {
                            potentialCards.push({
                                tagName: container.tagName,
                                className: container.className,
                                innerHTML: container.innerHTML.substring(0, 500) // First 500 chars
                            });
                            console.log('--- CARD HTML START ---');
                            console.log(container.innerHTML);
                            console.log('--- CARD HTML END ---');
                            break; // Found the card for this price
                        }
                        container = container.parentElement;
                    }
                }
            }

            // Deduplicate
            return potentialCards.filter((v, i, a) => a.findIndex(t => t.className === v.className) === i);
        });

        console.log('Potential Card Selectors:', JSON.stringify(cardInfo, null, 2));


        console.log('Checking for results text...');
        const bodyText = await page.innerText('body');
        if (bodyText.includes('properties found')) {
            console.log('✅ Found "properties found" text');
        } else if (bodyText.includes('No properties found')) {
            console.log('❌ Found "No properties found" text');
        } else {
            // Try to find the count element
            const count = await page.getByTestId('search-count').innerText().catch(() => 'unknown');
            console.log(`Search count testid: ${count}`);
        }

        const fullText = await page.innerText('body');
        fs.writeFileSync('page_text.txt', fullText);
        console.log(`Saved page text (${fullText.length} chars)`);

        await page.screenshot({ path: 'hoseasons_2026.png', fullPage: true });
        console.log('Saved screenshot to hoseasons_2026.png');

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
