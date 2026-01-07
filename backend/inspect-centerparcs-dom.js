#!/usr/bin/env node

/**
 * Center Parcs DOM Inspector
 * 
 * This script inspects the page DOM to find what elements/buttons
 * might trigger the accommodation search
 */

const { chromium } = require('playwright');

async function inspectCenterParcsDom() {
    console.log('🔍 Center Parcs DOM Inspector');
    console.log('='.repeat(50));

    const testUrl = 'https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/SF/16-03-2026/4/-/-/1/2/0/0/0/0/0/N';

    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        console.log('\n🌐 Loading page...');
        await page.goto(testUrl, { waitUntil: 'load', timeout: 30000 });

        // Wait for page to settle
        await page.waitForTimeout(5000);

        console.log('\n📋 Looking for search/filter buttons...');
        const buttons = await page.$$eval('button', btns =>
            btns.map(btn => ({
                text: btn.textContent?.trim().substring(0, 50),
                class: btn.className,
                id: btn.id,
                visible: btn.offsetParent !== null
            })).filter(b => b.visible && b.text)
        );

        console.log(`Found ${buttons.length} visible buttons:`);
        buttons.slice(0, 10).forEach((btn, i) => {
            console.log(`  ${i + 1}. "${btn.text}" (class: ${btn.class || 'none'})`);
        });

        console.log('\n📋 Looking for accommodation containers...');
        const containers = await page.$$eval('[class*="accommodation"], [class*="result"], [class*="lodge"]', els =>
            els.map(el => ({
                tag: el.tagName,
                class: el.className.substring(0, 50),
                id: el.id,
                text: el.textContent?.trim().substring(0, 50)
            })).slice(0, 10)
        );

        console.log(`Found ${containers.length} potential containers:`);
        containers.forEach((cont, i) => {
            console.log(`  ${i + 1}. <${cont.tag}> class="${cont.class}"`);
        });

        console.log('\n📋 Checking for Vue.js app...');
        const hasVue = await page.evaluate(() => {
            return !!(window.Vue || document.querySelector('[data-v-app]') || document.querySelector('[v-cloak]'));
        });
        console.log(`  Vue.js detected: ${hasVue}`);

        console.log('\n📋 Checking for React app...');
        const hasReact = await page.evaluate(() => {
            return !!(window.React || document.querySelector('[data-reactroot]'));
        });
        console.log(`  React detected: ${hasReact}`);

        console.log('\n📋 Looking for data attributes...');
        const dataAttrs = await page.evaluate(() => {
            const attrs = new Set();
            document.querySelectorAll('[data-testid], [data-component], [data-module]').forEach(el => {
                if (el.dataset.testid) attrs.add(`testid: ${el.dataset.testid}`);
                if (el.dataset.component) attrs.add(`component: ${el.dataset.component}`);
                if (el.dataset.module) attrs.add(`module: ${el.dataset.module}`);
            });
            return Array.from(attrs).slice(0, 10);
        });

        console.log(`Found ${dataAttrs.length} data attributes:`);
        dataAttrs.forEach(attr => console.log(`  - ${attr}`));

        console.log('\n📋 Checking page title and main heading...');
        const title = await page.title();
        const h1 = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Not found');
        console.log(`  Title: ${title}`);
        console.log(`  H1: ${h1}`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

if (require.main === module) {
    inspectCenterParcsDom()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { inspectCenterParcsDom };
