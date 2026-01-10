
import { chromium } from 'playwright';

async function run() {
    console.log('🚀 Probing Hoseasons Autocomplete API...');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage();

        // Monitor for ALL API calls
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.request().resourceType();

            // Filter noise
            if (['image', 'stylesheet', 'font', 'script'].includes(type) || url.includes('google') || url.includes('sentry')) return;

            // Log likely candidates
            if (url.includes('hoseasons') || url.includes('api')) {
                console.log(`\n📡 Request: ${response.request().method()} ${url}`);
                try {
                    const json = await response.json();
                    console.log('   📦 Response Snippet:', JSON.stringify(json).slice(0, 200));
                } catch {
                    // ignore non-json
                }
            }
        });

        await page.goto('https://www.hoseasons.co.uk', { waitUntil: 'domcontentloaded' });

        // Wait for WAF check
        try {
            await page.waitForFunction(() => document.body.innerText.includes('Hoseasons'), { timeout: 15000 });
        } catch { }

        // Try to handle cookie banner first
        try {
            const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
            if (await acceptBtn.isVisible({ timeout: 5000 })) {
                await acceptBtn.click();
                await page.waitForTimeout(500);
            }
        } catch { }

        console.log('⌨️  Simulating typing "County Durham"...');

        // 1. Click the "Enter destination" button to reveal the input
        const triggerBtn = page.getByRole('button', { name: 'destination' }).first();
        if (await triggerBtn.isVisible()) {
            await triggerBtn.click();
            await page.waitForTimeout(500);
        } else {
            console.log('⚠️ Trigger button not found, trying generic text match...');
            await page.getByText('Enter destination').first().click();
            await page.waitForTimeout(500);
        }

        // 2. Type into the "autocomplete" input
        const input = page.locator('#autocomplete');
        if (await input.isVisible()) {
            await input.click();
            await input.type('County Durham', { delay: 150 });
            console.log('✅ Typed "County Durham" into specific #autocomplete input');
            await page.waitForTimeout(5000); // Wait for API
        } else {
            console.log('⚠️  Input #autocomplete still not visible.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

run();
