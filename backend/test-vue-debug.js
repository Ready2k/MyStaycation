#!/usr/bin/env node

/**
 * Center Parcs - Try alternative approach: wait for Vue app to fully render
 */

const { chromium } = require('playwright');

async function testVueRendering() {
    console.log('⚡ Center Parcs Vue Rendering Test');
    console.log('='.repeat(50));

    const testUrl = 'https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/SF/16-03-2026/4/-/-/1/2/0/0/0/0/0/N';

    let browser;
    let interceptedData = null;

    try {
        browser = await chromium.launch({
            headless: false, // Run in headed mode to see what's happening
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Intercept ALL responses to see what's being called
        page.on('response', async (response) => {
            const url = response.url();
            const method = response.request().method();
            const status = response.status();

            console.log(`📡 ${method} ${url} (${status})`);

            if (url.includes('/api/v1/accommodation') && method === 'POST') {
                try {
                    interceptedData = await response.json();
                    console.log(`🎉 INTERCEPTED ACCOMMODATION DATA!`);
                } catch (e) {
                    console.log(`⚠️  Could not parse response`);
                }
            }
        });

        console.log('\n🌐 Navigating to:', testUrl);
        await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 60000 });

        console.log('\n✅ Page loaded, waiting 10 seconds to observe...\n');
        await page.waitForTimeout(10000);

        // Take a screenshot
        await page.screenshot({ path: '/tmp/centerparcs-debug.png' });
        console.log('📸 Screenshot saved to /tmp/centerparcs-debug.png');

        // Get page title and URL
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`\n📄 Title: ${title}`);
        console.log(`📍 Current URL: ${currentUrl}`);

        // Check for Vue app
        const vueInfo = await page.evaluate(() => {
            return {
                hasVue: !!window.Vue,
                vueVersion: window.Vue?.version,
                vueApps: document.querySelectorAll('[data-v-app], [id*="app"]').length
            };
        });
        console.log(`\n⚡ Vue info:`, vueInfo);

        if (interceptedData) {
            console.log('\n✅ SUCCESS!');
            return { success: true, data: interceptedData };
        } else {
            console.log('\n❌ No API data intercepted');
            return { success: false };
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            console.log('\nBrowser will stay open for 5 more seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await browser.close();
        }
    }
}

if (require.main === module) {
    testVueRendering()
        .then(result => {
            console.log('\nFINAL:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        });
}
