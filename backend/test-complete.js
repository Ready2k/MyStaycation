#!/usr/bin/env node

/**
 * Center Parcs Complete Test - Handle cookies and trigger search
 */

const { chromium } = require('playwright');

async function testWithCookieDismissal() {
    console.log('🍪 Center Parcs Complete Test (with cookie handling)');
    console.log('='.repeat(50));

    const testUrl = 'https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/SF/16-03-2026/4/-/-/1/2/0/0/0/0/0/N';

    let browser;
    let interceptedData = null;

    try {
        browser = await chromium.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set up API interception
        page.on('response', async (response) => {
            const url = response.url();
            const method = response.request().method();

            if (url.includes('centerparcs.co.uk') && url.includes('json')) {
                console.log(`   📡 ${method} ${url.split('centerparcs.co.uk')[1]}`);
            }

            if (url.includes('/api/v1/accommodation.json') && method === 'POST') {
                try {
                    interceptedData = await response.json();
                    console.log(`   🎉 ACCOMMODATION DATA INTERCEPTED!`);
                    console.log(`   📦 Size: ${JSON.stringify(interceptedData).length} bytes`);
                } catch (e) {
                    console.error(`   ❌ Error parsing JSON:`, e.message);
                }
            }
        });

        console.log('\n🌐 Loading page...');
        await page.goto(testUrl, { waitUntil: 'load', timeout: 30000 });
        console.log('✅ Page loaded\n');

        // Handle cookie consent
        console.log('🍪 Handling cookie consent...');
        try {
            // Try to find and click "Accept All" or similar button
            const cookieButtons = [
                'button:has-text("Accept All")',
                'button:has-text("Accept all")',
                'button:has-text("I Accept")',
                'button#onetrust-accept-btn-handler',
                'button.onetrust-close-btn-handler',
                'button.ot-pc-refuse-all-handler'
            ];

            for (const selector of cookieButtons) {
                try {
                    const btn = await page.$(selector);
                    if (btn) {
                        await btn.click({ timeout: 2000 });
                        console.log(`✅ Clicked cookie button: ${selector}`);
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch (e) {
                    // Try next selector
                }
            }
        } catch (e) {
            console.log('⚠️  Could not dismiss cookies, continuing anyway...');
        }

        // Wait for Vue to initialize
        console.log('\n⏳ Waiting for Vue.js to initialize...');
        await page.waitForTimeout(3000);

        // Try clicking search button
        console.log('🔍 Looking for search button...');
        try {
            const searchBtn = await page.$('button.btn-main-search');
            if (searchBtn) {
                console.log('✅ Found search button, clicking...\n');
                await searchBtn.click({ force: true, timeout: 5000 });

                // Wait for API response
                console.log('⏳ Waiting for API response...');
                const maxWait = 20000;
                const start = Date.now();

                while (!interceptedData && (Date.now() - start) < maxWait) {
                    await page.waitForTimeout(500);
                }
            }
        } catch (e) {
            console.log(`⚠️  Could not click search button: ${e.message}`);
        }

        // Check if data was intercepted
        if (interceptedData) {
            console.log('\n✅ SUCCESS! API data intercepted');

            // Analyze structure
            const keys = Object.keys(interceptedData);
            console.log(`\n📋 Top-level keys: ${keys.join(', ')}`);

            // Find accommodations
            let accommodations = [];
            if (interceptedData.data?.accommodation?.accommodationList) {
                accommodations = interceptedData.data.accommodation.accommodationList;
            } else if (interceptedData.accommodations) {
                accommodations = interceptedData.accommodations;
            } else if (interceptedData.results) {
                accommodations = interceptedData.results;
            }

            console.log(`📦 Found ${accommodations.length} accommodations`);

            if (accommodations.length > 0) {
                const sample = accommodations[0];
                console.log(`\n📋 Sample accommodation keys: ${Object.keys(sample).join(', ')}`);

                if (sample.availabilities && sample.availabilities[0]) {
                    console.log(`💰 Price structure: ${JSON.stringify(sample.availabilities[0].price || sample.availabilities[0], null, 2).substring(0, 200)}`);
                }
            }

            return { success: true, data: interceptedData, count: accommodations.length };
        }

        // Fallback: Check DOM for results
        console.log('\n🔍 Checking DOM for rendered results...');
        await page.waitForTimeout(3000);

        const domResults = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('[class*="accommodation"], [class*="lodge"], [class*="card"]');

            cards.forEach(card => {
                const priceEl = card.querySelector('[class*="price"]');
                const titleEl = card.querySelector('[class*="title"], [class*="name"], h2, h3');

                if (priceEl && titleEl) {
                    results.push({
                        title: titleEl.textContent?.trim(),
                        price: priceEl.textContent?.trim()
                    });
                }
            });

            return results;
        });

        if (domResults.length > 0) {
            console.log(`✅ Found ${domResults.length} results in DOM!`);
            console.log('\nSample results:');
            domResults.slice(0, 3).forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.title} - ${r.price}`);
            });

            return { success: true, method: 'dom-parsing', results: domResults };
        }

        console.log('\n❌ No results found');
        return { success: false };

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
            console.log('\n🔒 Browser closed');
        }
    }
}

if (require.main === module) {
    testWithCookieDismissal()
        .then(result => {
            console.log('\n' + '='.repeat(50));
            console.log('FINAL RESULT:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testWithCookieDismissal };
