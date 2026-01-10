
import { chromium } from 'playwright';

// Use a known good date to ensure search button is active/results exist
const START_DATE = '01-09-2026'; // DD-MM-YYYY

async function run() {
    console.log('Debugging Hoseasons Search Form interaction...');
    const browser = await chromium.launch({ headless: true }); // Keep headless for speed, use logs
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });

    try {
        const page = await context.newPage();

        // 1. Go to Home
        console.log('Navigating to home...');
        await page.goto('https://www.hoseasons.co.uk/', { waitUntil: 'domcontentloaded' });

        // 2. WAF / Cookie
        console.log('Handling WAF/Cookies...');
        try {
            const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
            if (await acceptBtn.isVisible({ timeout: 5000 })) {
                await acceptBtn.click();
                console.log('Clicked ACCEPT ALL');
            }
        } catch { }

        // 3. Find Search Box
        console.log('Looking for search inputs...');
        // Try generic selectors based on common patterns
        // "Where to?" is common placeholder
        // Or look for input[type="text"]

        // Debug dump inputs
        // const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, placeholder: i.placeholder, className: i.className })));
        // console.log('Inputs found:', inputs);

        // Try to type "Cornwall"
        // Usually the input has a placeholder "Destination..." or "Where to?"
        // Let's guess or use a broad selector
        const searchInput = page.getByPlaceholder('Destination, region or resort').first();
        if (await searchInput.isVisible()) {
            console.log('Found search input via placeholder');
            await searchInput.click();
            await searchInput.fill('Cornwall');
            await page.waitForTimeout(1000); // Wait for dropdown
            await page.keyboard.press('Enter');
            console.log('Typed Cornwall and pressed Enter');
        } else {
            console.log('Trying fallback selector for search input');
            // Fallback
            await page.locator('input[type="text"]').first().fill('Cornwall');
            await page.keyboard.press('Enter');
        }

        // 4. Wait for navigation / API
        console.log('Waiting for search results navigation...');
        await page.waitForURL('**/search**', { timeout: 15000 });

        const finalUrl = page.url();
        console.log('✅ Final URL after search:', finalUrl);

        await page.waitForTimeout(5000); // Wait for client render

    } catch (e) {
        console.error('Debug failed:', e);
        // Dump content
        // await page.screenshot({ path: 'debug-form-fail.png' });
    } finally {
        await browser.close();
    }
}

run();
