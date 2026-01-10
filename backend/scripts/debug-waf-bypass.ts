
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const url = 'https://www.hoseasons.co.uk/search?adult=2&child=0&infant=0&pets=0&range=0&nights=3&accommodationType=holiday-parks&regionName=Cornwall&start=01-09-2026&page=1&sort=recommended&displayMode=LIST';

async function run() {
    console.log('Testing WAF Bypass...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Waiting for "You control your data" or "Holiday Parks"...');

        // Wait for either the cookie banner OR the main content
        try {
            await page.waitForFunction(() => {
                const text = document.body.innerText;
                return text.includes('You control your data') || text.includes('Holiday Parks');
            }, { timeout: 30000 });
            console.log('✅ Found target text!');
        } catch {
            console.log('⚠️  Timed out waiting for text. Current title:', await page.title());
        }

        const html = await page.content();
        fs.writeFileSync('hoseasons_real.html', html);
        console.log(`Saved real HTML: ${html.length} bytes`);

        // Check for specific markers
        if (html.includes('awsWafCookieDomainList')) {
            console.log('⚠️  Output still resembles WAF page');
        } else {
            console.log('✅ Output looks like real site');
        }

        // Try to handle cookie banner
        try {
            const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
            if (await acceptBtn.isVisible()) {
                console.log('Clicking ACCEPT ALL...');
                await acceptBtn.click();
                await page.waitForTimeout(2000); // Wait for potential reload/ajax
            }
        } catch (e) {
            console.log('Cookie banner interaction failed:', e);
        }

        // Snapshot search results
        const resultCount = await page.locator('[data-test="search-result-card"]').count();
        console.log(`Detected search result cards: ${resultCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
