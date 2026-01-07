#!/usr/bin/env node

/**
 * Center Parcs API Interception Test Harness
 * 
 * This script tests the API interception approach for Center Parcs
 * by loading the search page and intercepting the POST request to
 * /api/v1/accommodation.json
 */

const { chromium } = require('playwright');

async function testCenterParcsInterception() {
    console.log('🧪 Center Parcs API Interception Test Harness');
    console.log('='.repeat(50));

    const testUrl = 'https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/SF/16-03-2026/4/-/-/1/2/0/0/0/0/0/N';
    console.log(`\n📍 Test URL: ${testUrl}`);
    console.log(`   Village: SF (Sherwood Forest)`);
    console.log(`   Date: 16-03-2026`);
    console.log(`   Nights: 4`);
    console.log(`   Party: 2 adults, 0 children\n`);

    let browser;
    let interceptedData = null;
    let sessionData = null;

    try {
        // Launch browser
        console.log('🚀 Launching browser...');
        browser = await chromium.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser', // Use system Chromium
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        // Set up response interception
        console.log('🎯 Setting up API interception...\n');

        page.on('response', async (response) => {
            const url = response.url();
            const method = response.request().method();

            // Log all JSON responses
            if (url.includes('centerparcs.co.uk') && url.includes('json')) {
                console.log(`   📡 ${method} ${url.split('centerparcs.co.uk')[1]} (${response.status()})`);
            }

            // Intercept session data
            if (url.includes('/api/v1/accommodation/session.json')) {
                try {
                    sessionData = await response.json();
                    console.log(`   ✅ Session data intercepted`);
                } catch (e) {
                    console.log(`   ⚠️  Failed to parse session data`);
                }
            }

            // Intercept accommodation data
            if (url.includes('/api/v1/accommodation.json') && method === 'POST') {
                try {
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        interceptedData = await response.json();
                        console.log(`   🎉 ACCOMMODATION DATA INTERCEPTED!`);
                        console.log(`   📦 Response size: ${JSON.stringify(interceptedData).length} bytes`);
                    }
                } catch (e) {
                    console.error(`   ❌ Error parsing accommodation JSON:`, e.message);
                }
            }
        });

        // Navigate to page
        console.log('🌐 Navigating to search page...');
        const startTime = Date.now();

        try {
            await page.goto(testUrl, {
                waitUntil: 'load',
                timeout: 60000
            });
            console.log(`✅ Page loaded (${Date.now() - startTime}ms)\n`);
        } catch (error) {
            console.log(`⚠️  Page load timeout, continuing anyway...\n`);
        }

        // Wait for API response
        console.log('⏳ Waiting for accommodation API response...');
        const maxWaitTime = 30000; // 30 seconds
        const pollStartTime = Date.now();

        while (!interceptedData && (Date.now() - pollStartTime) < maxWaitTime) {
            await page.waitForTimeout(500);

            // Show progress every 5 seconds
            const elapsed = Date.now() - pollStartTime;
            if (elapsed % 5000 < 500) {
                console.log(`   ⏱️  Waiting... (${Math.floor(elapsed / 1000)}s)`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(50) + '\n');

        if (interceptedData) {
            console.log('✅ SUCCESS! API data intercepted\n');

            // Analyze the data structure
            console.log('📋 Data Structure:');
            console.log(`   Top-level keys: ${Object.keys(interceptedData).join(', ')}\n`);

            // Try to find accommodation data
            let accommodations = [];
            if (interceptedData.data?.accommodation?.accommodationList) {
                accommodations = interceptedData.data.accommodation.accommodationList;
                console.log(`   ✅ Found accommodationList: ${accommodations.length} items`);
            } else if (interceptedData.accommodations) {
                accommodations = interceptedData.accommodations;
                console.log(`   ✅ Found accommodations: ${accommodations.length} items`);
            } else if (interceptedData.results) {
                accommodations = interceptedData.results;
                console.log(`   ✅ Found results: ${accommodations.length} items`);
            } else {
                console.log(`   ⚠️  Accommodation data structure unknown`);
                console.log(`   📄 Sample data: ${JSON.stringify(interceptedData).substring(0, 500)}...`);
            }

            if (accommodations.length > 0) {
                console.log(`\n📦 Sample Accommodation (first item):`);
                const sample = accommodations[0];
                console.log(`   Keys: ${Object.keys(sample).join(', ')}`);

                // Try to extract price
                if (sample.availabilities && sample.availabilities[0]) {
                    const avail = sample.availabilities[0];
                    console.log(`   💰 Price info: ${JSON.stringify(avail.price || avail.displayPrice || 'not found')}`);
                }
            }

            console.log(`\n✅ Test PASSED - API interception working!`);
            return { success: true, data: interceptedData, accommodations };

        } else {
            console.log('❌ FAILED - No API data intercepted\n');
            console.log('Possible reasons:');
            console.log('  1. Page structure changed');
            console.log('  2. API endpoint changed');
            console.log('  3. Timeout too short');
            console.log('  4. JavaScript execution blocked\n');

            // Get page content for debugging
            const html = await page.content();
            console.log(`📄 Page HTML size: ${html.length} bytes`);
            console.log(`   Contains "Choose your accommodation": ${html.includes('Choose your accommodation')}`);
            console.log(`   Contains "Sorry": ${html.includes('Sorry')}`);

            return { success: false, error: 'No API data intercepted' };
        }

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
            console.log('\n🔒 Browser closed');
        }
    }
}

// Run the test
if (require.main === module) {
    testCenterParcsInterception()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testCenterParcsInterception };
