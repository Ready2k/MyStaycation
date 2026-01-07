#!/usr/bin/env node

/**
 * Final comprehensive test - try everything
 */

const { chromium } = require('playwright');

async function finalTest() {
    console.log('🎯 FINAL COMPREHENSIVE TEST');
    console.log('='.repeat(60));

    // Try the exact URL from manual test
    const testUrl = 'https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/SF/16-03-2026/4/-/-/1/2/0/0/0/0/N';

    let browser;
    let interceptedData = null;
    let sessionData = null;

    try {
        browser = await chromium.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        // Intercept ALL requests and responses
        page.on('request', request => {
            const url = request.url();
            if (url.includes('accommodation')) {
                console.log(`🔵 REQUEST: ${request.method()} ${url.split('centerparcs.co.uk')[1] || url}`);
            }
        });

        page.on('response', async (response) => {
            const url = response.url();
            const method = response.request().method();

            // Log accommodation-related responses
            if (url.includes('accommodation') || url.includes('session')) {
                console.log(`🟢 RESPONSE: ${method} ${url.split('centerparcs.co.uk')[1] || url} (${response.status()})`);

                // Try to get response body
                try {
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('json')) {
                        const json = await response.json();

                        if (url.includes('/accommodation/session')) {
                            sessionData = json;
                            console.log(`   ✅ Session data captured`);
                        }

                        if (url.includes('/accommodation.json') && method === 'POST') {
                            interceptedData = json;
                            console.log(`   🎉 ACCOMMODATION DATA CAPTURED!`);
                            console.log(`   📦 Size: ${JSON.stringify(json).length} bytes`);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });

        console.log(`\n🌐 Loading: ${testUrl}\n`);

        // Try with networkidle and longer timeout
        await page.goto(testUrl, {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        console.log(`\n✅ Page loaded with networkidle\n`);

        // Wait additional time for any delayed requests
        console.log('⏳ Waiting 10 seconds for delayed requests...\n');
        await page.waitForTimeout(10000);

        // Check results
        console.log('='.repeat(60));
        console.log('RESULTS:');
        console.log('='.repeat(60));

        if (sessionData) {
            console.log('✅ Session data: YES');
        } else {
            console.log('❌ Session data: NO');
        }

        if (interceptedData) {
            console.log('✅ Accommodation data: YES');
            console.log(`📦 Data size: ${JSON.stringify(interceptedData).length} bytes`);

            // Analyze structure
            const keys = Object.keys(interceptedData);
            console.log(`📋 Keys: ${keys.join(', ')}`);

            return { success: true, data: interceptedData };
        } else {
            console.log('❌ Accommodation data: NO');

            // Check page content
            const html = await page.content();
            console.log(`\n📄 HTML size: ${html.length} bytes`);
            console.log(`   Contains "Choose your accommodation": ${html.includes('Choose your accommodation')}`);
            console.log(`   Contains "Sorry": ${html.includes('Sorry')}`);
            console.log(`   Contains "no availability": ${html.toLowerCase().includes('no availability')}`);

            return { success: false };
        }

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
    finalTest()
        .then(result => {
            console.log('\n' + '='.repeat(60));
            console.log('FINAL RESULT:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        });
}
