/**
 * Playwright diagnostic test for Away Resorts
 *
 * Run locally:
 *   node test-awayresorts.js
 *
 * Run inside the Synology worker container:
 *   docker cp test-awayresorts.js staycation-worker:/app/
 *   docker exec staycation-worker node test-awayresorts.js
 */

const { chromium } = require('playwright');

const URL = 'https://www.awayresorts.co.uk/search/?parkID=7&from=2026-08-17&to=2026-08-24&adults=6&children=0';

// Use system Chromium if PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set (e.g. on Synology)
// Fall back to /usr/bin/chromium if the env var path doesn't resolve
const EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (require('fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

if (EXECUTABLE_PATH) {
    console.log(`Using Chromium: ${EXECUTABLE_PATH}`);
} else {
    console.log('Using Playwright bundled Chromium');
}

// Test each config in sequence — stops at first success
const CONFIGS = [
    {
        label: 'Minimal (no-sandbox only)',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    {
        label: '+ disable-dev-shm-usage + disable-gpu',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
    {
        label: '+ single-process',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    },
    {
        label: '+ disable-webgl + disable-software-rasterizer',
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-gpu', '--disable-software-rasterizer',
            '--disable-webgl', '--disable-webgl2', '--disable-3d-apis',
        ],
    },
    {
        label: 'Block images/media/fonts via route',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        blockResources: true,
    },
];

async function test(config) {
    console.log(`\n▶  Testing: ${config.label}`);
    let browser;
    try {
        browser = await chromium.launch({ headless: true, args: config.args, executablePath: EXECUTABLE_PATH });

        const page = await browser.newPage();

        page.on('crash', () => console.error('   ❌ Page crash event fired'));
        page.on('pageerror', err => console.warn('   ⚠️  Page error:', err.message));

        if (config.blockResources) {
            await page.route('**/*', route => {
                if (['image', 'media', 'font', 'stylesheet'].includes(route.request().resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
        }

        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const html = await page.content();
        console.log(`   ✅ SUCCESS — got ${html.length} bytes of HTML`);

        // Check if there's any useful content
        const hasResults = html.includes('parkID') || html.includes('price') || html.includes('search');
        console.log(`   📄 Content looks useful: ${hasResults}`);

        await page.close();
        return true;

    } catch (err) {
        console.error(`   ❌ FAILED: ${err.message.split('\n')[0]}`);
        return false;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

async function run() {
    console.log('=== Away Resorts Playwright Diagnostic ===');
    console.log(`URL: ${URL}`);
    console.log(`Node: ${process.version}`);

    // Print Chromium version
    try {
        const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: EXECUTABLE_PATH });
        const version = browser.version();
        console.log(`Chromium: ${version}`);
        await browser.close();
    } catch (e) {
        console.log(`Chromium version check failed: ${e.message}`);
    }

    for (const config of CONFIGS) {
        const ok = await test(config);
        if (ok) {
            console.log(`\n✅ Winning config: "${config.label}"`);
            console.log('   args:', JSON.stringify(config.args));
            if (config.blockResources) console.log('   blockResources: true');
            process.exit(0);
        }
    }

    console.log('\n❌ All configs failed — Away Resorts may be actively blocking headless Chromium on this platform.');
    console.log('   Recommendation: set PROVIDER_AWAYRESORTS_ENABLED=false in .env');
    process.exit(1);
}

run();
