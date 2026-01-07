#!/usr/bin/env node

/**
 * Center Parcs Search Trigger Test
 * 
 * This script tries clicking the "Search again" button to trigger
 * the accommodation API call
 */

const { chromium } = require('playwright');

async function testSearchTrigger() {
    console.log('🔘 Center Parcs Search Trigger Test');
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
                } catch (e) {
                    console.error(`   ❌ Error parsing JSON:`, e.message);
                }
            }
        });

        console.log('\n🌐 Loading page...');
        await page.goto(testUrl, { waitUntil: 'load', timeout: 30000 });

        console.log('✅ Page loaded\n');

        // Wait for Vue to initialize
        console.log('⏳ Waiting for Vue.js to initialize...');
        await page.waitForTimeout(3000);

        // Try to find and click the search button
        console.log('🔍 Looking for search button...');
        const searchButton = await page.$('button.btn-main-search, button:has-text("Search again")');

        if (searchButton) {
            console.log('✅ Found search button, clicking...\n');
            await searchButton.click();

            // Wait for API response
            console.log('⏳ Waiting for API response after click...');
            const maxWaitTime = 20000;
            const startTime = Date.now();

            while (!interceptedData && (Date.now() - startTime) < maxWaitTime) {
                await page.waitForTimeout(500);
            }

            if (interceptedData) {
                console.log('\n✅ SUCCESS! API call triggered by button click');
                console.log(`📦 Data size: ${JSON.stringify(interceptedData).length} bytes`);

                // Analyze structure
                console.log(`\n📋 Data keys: ${Object.keys(interceptedData).join(', ')}`);

                return { success: true, triggeredBy: 'button-click', data: interceptedData };
            } else {
                console.log('\n⚠️  Button clicked but no API call detected');
            }
        } else {
            console.log('❌ Search button not found');
        }

        // Alternative: Check if results are already in the page
        console.log('\n🔍 Checking if results loaded automatically...');
        await page.waitForTimeout(5000);

        if (interceptedData) {
            console.log('✅ Results loaded automatically!');
            return { success: true, triggeredBy: 'auto-load', data: interceptedData };
        }

        // Last resort: check DOM for results
        console.log('\n🔍 Checking DOM for rendered results...');
        const resultsInDom = await page.$$eval('[class*="accommodation-card"], [class*="lodge-card"], [class*="result-item"]', els => els.length);
        console.log(`Found ${resultsInDom} result elements in DOM`);

        if (resultsInDom > 0) {
            console.log('✅ Results are in DOM (rendered client-side)');
            return { success: true, triggeredBy: 'dom-render', resultsCount: resultsInDom };
        }

        console.log('\n❌ No results found via any method');
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
    testSearchTrigger()
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

module.exports = { testSearchTrigger };
