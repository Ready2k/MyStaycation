/// <reference lib="dom" />
import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher, MatchConfidence } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';
import type { Page } from 'playwright';

export class HoseasonsAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.HOSEASONS_BASE_URL || 'https://www.hoseasons.co.uk',
            'hoseasons'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        if (!this.isEnabled()) {
            console.log('⚠️  Hoseasons adapter is disabled');
            return [];
        }

        // If specific parks are requested, search them in parallel
        if (params.parks && params.parks.length > 0) {
            console.log(`🌐 Hoseasons: Searching ${params.parks.length} parks in parallel:`, params.parks);
            const promises = params.parks.map(parkId => this.searchSingle(params, parkId));
            const results = await Promise.all(promises);
            // Flatten results array
            const flat = results.flat();
            console.log(`✅ Hoseasons: Total results from parallel search: ${flat.length}`);
            return flat;
        }

        // Otherwise perform standard region search
        return this.searchSingle(params);
    }

    private async searchSingle(params: SearchParams, parkIdOverride?: string): Promise<PriceResult[]> {
        // [MODIFIED] URL construction is now handled inside fetchHoseasonsWithBrowser
        // to support async dynamic ID resolution.

        try {
            // [MODIFIED] Use Browser Fetch instead of direct API fetch
            let rawResult: string;
            try {
                rawResult = await this.fetchHoseasonsWithBrowser(params, parkIdOverride);
            } catch (e) {
                console.error('Browser fetch failed:', e);
                return [];
            }

            const parsed = JSON.parse(rawResult);

            // [FIX] For Slug-based searches (e.g. /holiday-parks/devon), the Hoseasons page 
            // fires an internal API call that is "poisoned" (ignores region filter).
            // However, the DOM (scrapedData) correctly renders the filtered result.
            // So for slug searches, we MUST prioritize scraped data if available.
            // Note: We don't have the URL here anymore to check .includes, but we can check if
            // the result mentions it was a fallback.

            if (parsed.scrapedData && parsed.scrapedData.length > 0) {
                // Check if we fell back to scraping (flagged in result or implied)
                // Or just trust scraping results if provided.
                return this.parseScrapedResults(parsed.scrapedData, params);
            }

            if (parsed.interceptedData) {
                // If we have intercepted data, it heavily implies the ID resolution worked 
                // and we got valid API data.
                return this.parseApiResponse(parsed.interceptedData, params, parkIdOverride);
            }

            return [];
        } catch (error) {
            console.error('❌ Hoseasons search failed:', error);
            return [];
        }
    }

    private parseScrapedResults(scrapedData: unknown[], params: SearchParams): PriceResult[] {
        return scrapedData.map((item: any) => {
            // Parse price string "£123" -> 123
            const priceVal = parseFloat(item.price.replace(/[£,]/g, ''));

            // Map scanned fields to PriceResult interface
            return {
                stayStartDate: params.dateWindow.start,
                stayNights: params.nights.min,
                priceTotalGbp: priceVal,
                pricePerNightGbp: this.calculatePricePerNight(priceVal, params.nights.min) || 0,
                availability: 'AVAILABLE',
                // Derive accomType from URL
                accomType: item.deepLink && (item.deepLink.includes('/boat-holidays/') || item.deepLink.includes('/boating/'))
                    ? 'boat'
                    : (item.deepLink && item.deepLink.includes('/lodges/') ? 'lodge' : 'holiday-park'),
                sourceUrl: this.normalizeUrl(item.deepLink),
                matchConfidence: MatchConfidence.STRONG, // Assumed if on page

                // Real-world fields
                propertyName: item.name,
                location: item.region || params.region || 'Unknown',
                bedrooms: Math.ceil((params.party.adults || 2) / 2),
                petsAllowed: params.pets,
                // Extract parkId from URL (last path segment) - CRITICAL for PreviewService
                parkId: item.deepLink ? item.deepLink.split('?')[0].split('/').filter(Boolean).pop() || 'unknown' : 'unknown'
            };
        });
    }

    /**
     * Map common region names to Hoseasons-specific ones
     */
    /**
     * Map region name to Hoseasons 'placesId' or 'regionId'
     * Uses a manual map for known oddities, then falls back to dynamic resolution.
     */
    private regionIdCache = new Map<string, string>();

    /**
     * Map region name to Hoseasons 'placesId'
     * Uses a manual map for known oddities, then falls back to dynamic resolution.
     */
    private async resolveRegionId(region: string, page: Page): Promise<string | undefined> {
        if (!region) return undefined;
        const lower = region.toLowerCase().trim();

        // 1. Check Memory Cache
        if (this.regionIdCache.has(lower)) {
            console.log(`✅ ID Cache Hit for "${region}": ${this.regionIdCache.get(lower)}`);
            return this.regionIdCache.get(lower);
        }

        // 2. Check Static Map (Fast Fallback & Known Oddities)
        const map: Record<string, string> = {
            'devon': '39248',
            'cornwall': '39246',
            'northumberland': '39023',
            'kielder': '39023',
            'kielder lakes': '39023',
            'kielder water': '39023',
            'norfolk broads': '21645'
        };

        if (map[lower]) {
            this.regionIdCache.set(lower, map[lower]);
            return map[lower];
        }

        // 3. Dynamic Resolution Probe
        console.log(`🔎 Dynamically resolving ID for region: "${region}"...`);
        const slug = this.getRegionSlug(region);

        // Probing candidates: Standard first, then Lodges (which works for County Durham)
        const candidates = [
            `/holiday-parks/${slug}`,               // Standard (e.g. Devon)
            `/lodges/england/${slug}`,              // Lodges (e.g. County Durham)
            `/holiday-parks/england/${slug}`,       // Nested
            `/cottages/${slug}`,                    // Rare
            `/boat-holidays/${slug}`                // Boats
        ];

        for (const path of candidates) {
            const url = `${this.baseUrl}${path}`;
            console.log(`   👉 Probing URL: ${path}`);
            try {
                // Use a lightweight goto to check validity
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                // [FIX] Wait for WAF/Interstitial to clear
                try {
                    await page.waitForFunction(() => {
                        const text = document.body.innerText;
                        return text.length > 500 && (text.includes('Hoseasons') || text.includes('Error 404'));
                    }, { timeout: 10000 });
                } catch {
                    // If timeout, likely a real 404 or stuck. Check title now.
                }

                // Check for 404 title or redirect
                const title = await page.title();
                // console.log(`   Status: ${response?.status()}, Title: "${title}"`);

                if (title.includes('404') || response?.status() === 404 || title.includes('Page Not Found')) {
                    // console.log(`   ⛔️ 404 detected for ${path}`);
                    continue;
                }

                // Extract ID from Page State
                const id = await page.evaluate(() => {
                    // Method A: Check __NEXT_DATA__
                    try {
                        const nextData = (window as any).__NEXT_DATA__;
                        if (nextData?.props?.pageProps?.initialState?.placesId) return nextData.props.pageProps.initialState.placesId;
                        // Sometimes it's deep in filters
                        if (nextData?.props?.pageProps?.initialState?.searchCriteria?.placesId) return nextData.props.pageProps.initialState.searchCriteria.placesId;
                    } catch {
                        // Ignore parse errors
                    }

                    // Method B: Regex on body (Fallback)
                    const html = document.body.innerHTML;
                    const match = html.match(/"placesId"\s*[:=]\s*["']?(\d+)["']?/);
                    return match ? match[1] : null;
                });

                if (id) {
                    console.log(`   🎉 FOUND ID: ${id} at ${path}`);
                    this.regionIdCache.set(lower, id);
                    return id;
                }

            } catch (e) {
                console.warn(`   ⚠️ Probe failed for ${path}: ${e}`);
            }
        }

        console.log(`❌ Failed to resolve ID for "${region}". using generic fallback.`);
        return undefined;
    }

    private getRegionSlug(region: string): string {
        if (!region) return '';
        const lower = region.toLowerCase().trim();
        if (lower === 'devon') return 'devon';
        return lower.replace(/[^a-z0-9]+/g, '-');
    }

    /**
     * Build the Hoseasons search URL using path-based routing
     * e.g. https://www.hoseasons.co.uk/holiday-parks/cornwall?checks...
     */
    protected buildSearchUrl(params: SearchParams, regionId?: string, parkIdOverride?: string): string {
        const queryParams = new URLSearchParams();

        // Determine accommodation type
        let accommodationType = 'holiday-parks';
        const propertyType = (params.metadata as any)?.propertyType;

        if (propertyType && propertyType !== 'Any') {
            const type = (propertyType as string).toLowerCase();
            // Special case: Boats use 'boat-holidays' not 'boats'
            if (type === 'boat') {
                accommodationType = 'boat-holidays';
            } else {
                accommodationType = type.endsWith('s') ? type : type + 's';
            }
        }

        let baseUrl = `${this.baseUrl}/search`;

        if (parkIdOverride) {
            queryParams.append('parkId', parkIdOverride);
            // No region needed if parkId is specified
        } else if (regionId) {
            // Priority: Logic resolved ID
            // Boats use 'region' parameter, others use 'placesId'
            if (accommodationType === 'boat-holidays') {
                queryParams.append('region', regionId);
                // Boats prefer path-based URL + ID param
                const slug = this.getRegionSlug(params.region || '');
                if (slug) {
                    baseUrl = `${this.baseUrl}/boat-holidays/united-kingdom/${slug}`;
                }
            } else {
                queryParams.append('placesId', regionId);
                // Standard parks can also use slug if available, but /search is safer/standard for API
            }
            queryParams.append('regionName', params.region || '');
        } else {
            // Fallback to name/slug logic (Old Hybrid)
            const slug = this.getRegionSlug(params.region || '');
            if (accommodationType === 'holiday-parks' && slug) {
                baseUrl = `${this.baseUrl}/holiday-parks/${slug}`;
            } else if (accommodationType === 'boat-holidays' && slug) {
                // Boats use /boat-holidays/united-kingdom/{region}
                baseUrl = `${this.baseUrl}/boat-holidays/united-kingdom/${slug}`;
            } else {
                queryParams.append('regionName', params.region || '');
            }
        }

        // Append Common Params
        if (baseUrl.includes('/search')) {
            queryParams.append('accommodationType', accommodationType);
        }

        if (params.party.adults) queryParams.append('adult', params.party.adults.toString());
        if (params.party.children) queryParams.append('child', params.party.children.toString());
        if (params.pets) queryParams.append('pets', params.pets ? '1' : '0');

        // Date handling
        if (params.dateWindow.start) {
            const date = new Date(params.dateWindow.start);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            queryParams.append('start', `${day}-${month}-${year}`);
        }

        if (params.nights.min) {
            queryParams.append('nights', params.nights.min.toString());
        }

        // Common defaults
        queryParams.append('range', '0');
        queryParams.append('page', '1');
        queryParams.append('sort', 'recommended');
        queryParams.append('displayMode', 'LIST');

        return `${baseUrl}?${queryParams.toString()}`;
    }

    /**
     * Custom Playwright fetch for Hoseasons with API interception
     */
    private async fetchHoseasonsWithBrowser(params: SearchParams, parkIdOverride?: string): Promise<string> {
        const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
        if (!playwrightEnabled) {
            throw new Error('Playwright is disabled');
        }

        if (!this.browser) {
            const { chromium } = await import('playwright');
            this.browser = await chromium.launch({
                headless: true,
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                ],
            });
        }

        const page = await this.browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        // [NEW] Helper to build URL (local closure to access `this`)
        // Actually best to resolve ID here then call this.buildSearchUrl

        let regionId: string | undefined;
        if (!parkIdOverride && params.region) {
            regionId = await this.resolveRegionId(params.region, page);
        }

        const url = this.buildSearchUrl(params, regionId, parkIdOverride);
        console.log(`🔗 Navigating to: ${url}`);

        let searchResultsData: any = null;

        try {
            // Set up response interception to capture the search API call
            page.on('response', async (response) => {
                const responseUrl = response.url();

                // Look for API calls that might contain search results
                // Common patterns: /api/search, /search-api, /properties, etc.
                if (responseUrl.includes('/api/') ||
                    responseUrl.includes('search') ||
                    responseUrl.includes('properties') ||
                    responseUrl.includes('accommodation')) {

                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            const json = await response.json();

                            // Check if this response contains property data
                            if (json.properties || json.results || json.data?.properties || json.accommodations) {
                                console.log(`🎯 Intercepted API response from: ${responseUrl}`);
                                searchResultsData = json;
                            }
                        }
                    } catch (e) {
                        // Not JSON or failed to parse, ignore
                    }
                }
            });



            page.on('console', msg => console.log('PAGE LOG:', msg.text()));

            // Navigate to the page
            console.log('🌐 Navigating to search page...');

            // Navigate and wait for initial load
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // [NEW] WAF Bypass & Cookie Handling
            try {
                console.log('⏳ Waiting for WAF challenge / Site load...');
                // Wait for the real site to render (bypass WAF)
                await page.waitForFunction(() => {
                    const text = document.body.innerText;
                    return text.includes('You control your data') || text.includes('Holiday Parks') || text.includes('Hoseasons');
                }, { timeout: 30000 });
                console.log('✅ Site loaded (WAF passed)');

                // Handle Cookie Banner if present
                console.log('🍪 Checking for cookie banner...');
                try {
                    // Look for the "ACCEPT ALL" button specifically
                    // Using a broad selector to catch different variations
                    const acceptBtn = page.getByRole('button', { name: 'ACCEPT ALL' });
                    if (await acceptBtn.isVisible({ timeout: 5000 })) {
                        await acceptBtn.click();
                        console.log('✅ Clicked ACCEPT ALL cookies');
                        // Small pause to let any fired events process
                        await page.waitForTimeout(1000);
                    }
                } catch (e) {
                    console.log('ℹ️  No clickable cookie banner found or already accepted');
                }

            } catch (e) {
                console.warn('⚠️  Site load check failed or timed out:', e);
            }

            // Wait for the API response with polling
            console.log('⏳ Waiting for API response (interception)...');
            const maxWaitTime = 20000; // 20 seconds
            const startTime = Date.now();

            while (!searchResultsData && (Date.now() - startTime) < maxWaitTime) {
                await page.waitForTimeout(500);
            }

            // If we intercepted API data, return it as JSON string
            if (searchResultsData) {
                console.log('✅ Successfully intercepted search results API');
                return JSON.stringify({ interceptedData: searchResultsData });
            }

            console.warn('⚠️  No API call intercepted, falling back to DOM Scraping');

            // DOM Scraping Logic
            const scrapedResults = await page.evaluate(() => {
                // Strategy 1: Price-First (Works for Search Page)
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                const priceNodes: Node[] = [];
                while ((node = walker.nextNode())) {
                    if (node.textContent && node.textContent.includes('£') && /\d/.test(node.textContent)) {
                        if (node.parentElement) priceNodes.push(node.parentElement);
                    }
                }

                const seenContainers = new Set();
                const priceFirstResults = [];

                for (const priceEl of priceNodes) {
                    let container: Element | null = priceEl as Element;
                    let depth = 0;
                    while (container && container !== document.body && depth < 10) {
                        if (seenContainers.has(container)) break;

                        const text = (container as HTMLElement).innerText || '';
                        // Basic heuristic: Card must have "nights" and "£" and some sleeping cap info
                        if (text.includes('nights') && (text.includes('out of') || text.includes('Sleeps') || text.includes('Bedrooms'))) {
                            seenContainers.add(container);

                            const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                            // Extract Price
                            const priceMatches = text.match(/£([\d,]+)/g);
                            let bestPrice = '0';
                            let maxVal = 0;
                            if (priceMatches) {
                                for (const pm of priceMatches) {
                                    const val = parseInt(pm.replace(/[£,]/g, ''), 10);
                                    if (val > maxVal && val > 40) {
                                        maxVal = val;
                                        bestPrice = pm;
                                    }
                                }
                            }

                            // Extract Name
                            let nameIndex = 0;
                            if (lines[0].match(/^\d+\/\d+/)) nameIndex = 2; // 1/12 \n Location \n Name
                            else if (lines[0].includes(',')) nameIndex = 1; // Location \n Name

                            const name = lines[nameIndex] || lines[0];
                            const location = nameIndex > 0 ? lines[nameIndex - 1] : '';

                            // Validation for Strategy 1
                            if (name.includes('Holidays') || name.includes('Holiday Parks in') || name.includes('Lodges in')) {
                                console.log('Skipping Strategy 1 (Generic Header):', name);
                                continue;
                            }
                            const dLink = (container as Element).querySelector('a')?.href || '';
                            if (!dLink || dLink.includes('search?')) {
                                console.log('Skipping Strategy 1 (Invalid Link):', name, dLink);
                                continue;
                            }
                            const isPropertyLink = dLink.includes('/holiday-parks/') ||
                                dLink.includes('/lodges/') ||
                                dLink.includes('/cottages/') ||
                                dLink.includes('/boat-holidays/') ||
                                dLink.includes('/boating/');

                            if (!isPropertyLink) {
                                console.log('Skipping Strategy 1 (Not Property Link):', name, dLink);
                                continue;
                            }


                            if (maxVal > 0) {
                                priceFirstResults.push({
                                    name: name,
                                    region: location,
                                    price: bestPrice,
                                    deepLink: dLink
                                });
                            }
                            break;
                        }
                        container = (container as Element).parentElement;
                        depth++;
                    }
                }

                if (priceFirstResults.length > 0) return priceFirstResults;

                // Strategy 2: Header-First (Works for Holiday Parks / Slug Pages)
                const headers = Array.from(document.querySelectorAll('h3, .card-header, h2'));
                const headerResults = [];


                for (const header of headers) {
                    // Walk up to find a container that has a price
                    let container = header.parentElement;
                    let depth = 0;
                    let foundPrice = false;
                    let bestPrice = '0';
                    let maxVal = 0;
                    let deepLink = '';

                    while (container && container !== document.body && depth < 6) {
                        const text = (container as HTMLElement).innerText || '';
                        if (text.includes('£')) {
                            // potential card
                            const priceMatches = text.match(/£([\d,]+)/g);
                            if (priceMatches) {
                                for (const pm of priceMatches) {
                                    const val = parseInt(pm.replace(/[£,]/g, ''), 10);
                                    if (val > maxVal && val > 40) {
                                        maxVal = val;
                                        bestPrice = pm;
                                        foundPrice = true;
                                    }
                                }
                            }
                            if (foundPrice) {
                                // Look for link
                                deepLink = container.querySelector('a')?.href || '';
                                // Stop walking up if we found a valid card container
                                break;
                            }
                        }
                        container = container.parentElement;
                        depth++;
                    }

                    if (foundPrice && (header as HTMLElement).innerText.length > 3) {
                        const name = (header as HTMLElement).innerText.split('\n')[0]; // simple clean

                        // Validation: Ignore generic headers like "Norfolk Holidays" or "Holiday Parks in ..."
                        if (name.includes('Holidays') || name.includes('Holiday Parks in') || name.includes('Lodges in')) {
                            console.log('Skipping Strategy 2 (Generic Header):', name);
                            continue;
                        }

                        // Validation: Ignore price labels captured as names
                        // Regex checks for "Was", "Now", "From" at start, or pure price strings
                        if (/^(was|now|from)\s/i.test(name) || name.includes('£') || /^£/.test(name)) {
                            console.log('Skipping Strategy 2 (Price Label):', name);
                            continue;
                        }

                        // Validation: Must have a valid deep link to a specific property/park
                        // Typically /holiday-parks/CODE or /lodges/CODE or /cottages/CODE
                        if (!deepLink || deepLink.includes('search?')) {
                            console.log('Skipping Strategy 2 (Invalid Link):', name, deepLink);
                            continue;
                        }
                        const isPropertyLink = deepLink.includes('/holiday-parks/') ||
                            deepLink.includes('/lodges/') ||
                            deepLink.includes('/cottages/') ||
                            deepLink.includes('/boat-holidays/') ||
                            deepLink.includes('/boating/');

                        if (!isPropertyLink) {
                            console.log('Skipping Strategy 2 (Not Property Link):', name, deepLink);
                            continue;
                        }

                        headerResults.push({
                            name: name,
                            region: '', // Return empty to allow fallback to params.region
                            price: bestPrice,
                            deepLink: deepLink
                        });
                    }
                }

                if (headerResults.length > 0) return headerResults;

                // Strategy 3: Article-Based (Robust for Slug Pages)
                // The debug script showed cards are wrapped in <article> tags and contain '£' and 'nights'
                const articles = Array.from(document.querySelectorAll('article'));
                const articleResults = [];

                for (const article of articles) {
                    const text = (article as HTMLElement).innerText || '';
                    if (!text.includes('£')) continue;

                    // Extract Price
                    const priceMatches = text.match(/£([\d,]+)/g);
                    let bestPrice = '0';
                    let maxVal = 0;
                    if (priceMatches) {
                        for (const pm of priceMatches) {
                            const val = parseInt(pm.replace(/[£,]/g, ''), 10);
                            // Avoid tiny numbers (deposits) but be flexible
                            if (val > maxVal && val > 40) {
                                maxVal = val;
                                bestPrice = pm;
                            }
                        }
                    }

                    if (maxVal === 0) continue;

                    // Extract Link
                    const dLink = article.querySelector('a')?.href || '';
                    // Must be a property link
                    if (!dLink || dLink.includes('search?') || (!dLink.includes('/holiday-parks/') && !dLink.includes('/lodges/') && !dLink.includes('/cottages/') && !dLink.includes('/boat-holidays/'))) {
                        continue;
                    }

                    // Extract Name
                    // Usually the first line or near it.
                    // Debug text: "Bideford, Nr Clovelly, Devon | | Bideford Bay | ..."
                    // The Name is Bideford Bay. The location is Bideford...
                    // Let's try to split by newline and find the most "name-like" string or use the link text?
                    // Often the link wraps the image/title.
                    // Let's grab the text of the first H3 or H2 inside, otherwise first line.
                    let name = '';
                    const titleEl = article.querySelector('h2, h3, h4');
                    if (titleEl) {
                        name = (titleEl as HTMLElement).innerText.trim();
                    } else {
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.length > 3);
                        // Heuristic: 2nd line if 1st line is Location (contains comma)
                        if (lines[0].includes(',') && lines[1]) {
                            name = lines[1];
                        } else {
                            name = lines[0];
                        }
                    }

                    if (!name) continue;

                    articleResults.push({
                        name: name,
                        region: 'Derived from Search',
                        price: bestPrice,
                        deepLink: dLink
                    });
                }

                return articleResults;
            });

            console.log(`✅ Scraped ${scrapedResults.length} properties from DOM`);
            return JSON.stringify({ scrapedData: scrapedResults });

        } finally {
            await page.close();
        }
    }

    async fetchOffers(): Promise<DealResult[]> {
        if (!this.isEnabled()) {
            return [];
        }

        const url = this.buildOffersUrl();

        try {
            const html = await this.fetchHtml(url);
            return this.parseOffers(html);
        } catch (error) {
            console.error('Failed to fetch Hoseasons offers:', error);
            return [];
        }
    }

    // Old buildSearchUrl implementation removed/replaced above
    /*
    protected buildSearchUrl(params: SearchParams): string {
         ...
    }
    */

    /*
    private buildSearchUrlWithOverride(params: SearchParams, parkIdOverride?: string): string {
         ...
    }
    */

    /*
    protected buildSearchUrl(params: SearchParams, parkIdOverride?: string): string {
        return this.buildSearchUrlWithOverride(params, parkIdOverride);
    }
    */

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/special-offers`;
    }

    /**
     * Parse Hoseasons API response
     */
    private parseApiResponse(data: any, params: SearchParams, parkIdFilter?: string): PriceResult[] {
        const results: PriceResult[] = [];

        if (!data.properties || !Array.isArray(data.properties)) {
            console.warn('⚠️  No properties array in API response');
            return [];
        }

        console.log(`📦 Processing ${data.properties.length} properties from API...`);

        data.properties.forEach((property: any) => {
            if (parkIdFilter) {
                // DEBUG: Identify which field matches the parkIdFilter (placesId)

                // Provisional Filtering Logic (commented out until field confirmed)
                // if (String(property.placesId) !== String(parkIdFilter)) return; 
            }

            try {
                // Extract price
                const priceTotalGbp = property.priceFrom || property.lowestPrice;
                if (!priceTotalGbp || typeof priceTotalGbp !== 'number') {
                    return; // Skip if no valid price
                }

                // Extract dates
                const stayStartDate = property.startDate ? new Date(property.startDate).toISOString().split('T')[0] : params.dateWindow.start;

                // Extract nights
                const stayNights = property.lengthOfStay || params.nights.min;

                // Calculate per night price
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights);
                if (!pricePerNightGbp) {
                    return;
                }

                // Extract property details
                // Try multiple fields for bedrooms
                let bedrooms = property.bedrooms || property.bedroomCount;

                // If bedrooms missing, try to infer from 'sleeps' or default based on party size
                if (!bedrooms) {
                    if (property.sleeps) {
                        bedrooms = Math.ceil(property.sleeps / 2);
                    } else {
                        // Default to 1 bedroom per 2 adults (safe assumption for parks)
                        bedrooms = Math.ceil((params.party.adults || 1) / 2);
                    }
                }

                // If we searched for pets, assume the result allows pets (API filtering)
                // Otherwise check specific flags
                let petsAllowed = params.pets;
                if (property.petsGoFree !== undefined) petsAllowed = property.petsGoFree || params.pets;
                if (property.petFriendly !== undefined) petsAllowed = property.petFriendly;

                // Fallback: If we searched for pets=1, Hoseasons returns pet-friendly places
                if (params.pets && !petsAllowed) {
                    // Check if 'pets' is in USPs or features
                    const usps = JSON.stringify(property.USPs || []);
                    if (usps.toLowerCase().includes('pet')) {
                        petsAllowed = true;
                    } else {
                        // Trust the search param if we can't find a flag
                        petsAllowed = true;
                    }
                }

                const accomType = property.accommodationType || 'holiday-park';
                const propertyName = property.displayName || property.name || property.title;
                const location = property.location || property.rhs3 || property.regionName;

                // Build source URL
                const sourceUrl = property.code
                    ? `${this.baseUrl}/holiday-parks/${property.code}`
                    : undefined;

                // Classify result
                const candidateRes = {
                    stayStartDate,
                    stayNights,
                    priceTotalGbp,
                    availability: 'AVAILABLE' as const,
                    accomType,
                    bedrooms,
                    petsAllowed
                };

                const matchResult = ResultMatcher.classify(candidateRes, {
                    targetData: {
                        dateStart: params.dateWindow.start,
                        nights: params.nights.min,
                        party: params.party,
                        pets: params.pets,
                        accommodationType: params.accommodation || AccommodationType.ANY,
                        minBedrooms: params.minBedrooms
                    }
                });

                results.push({
                    stayStartDate,
                    stayNights,
                    priceTotalGbp,
                    pricePerNightGbp,
                    availability: 'AVAILABLE',
                    accomType,
                    sourceUrl: this.normalizeUrl(sourceUrl),
                    matchConfidence: matchResult.confidence,
                    matchDetails: matchResult.description,
                    bedrooms,
                    petsAllowed,
                    propertyName,
                    location,
                    parkId: property.code
                });
            } catch (error) {
                console.error('Error parsing property from API:', error);
            }
        });

        console.log(`✅ Parsed ${results.length} valid results from Hoseasons API`);
        return results;
    }

    protected parseSearchResults(_html: string, _params: SearchParams): PriceResult[] {
        // This method is no longer used - we call the API directly now
        console.warn('⚠️  parseSearchResults called but Hoseasons uses API directly');
        return [];
    }

    protected parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const deals: DealResult[] = [];

        // NOTE: These selectors are EXAMPLES
        $('.offer-card, .deal-item').each((_, element) => {
            try {
                const $el = $(element);

                const title = $el.find('.offer-title, h2, h3').first().text().trim();
                if (!title) return;

                // Extract discount information
                const discountText = $el.find('.discount, .save').first().text().trim();
                let discountType: DealResult['discountType'] = 'PERK';
                let discountValue: number | undefined;

                if (discountText.includes('%')) {
                    discountType = 'PERCENT_OFF';
                    const value = this.extractPrice(discountText.replace('%', ''));
                    discountValue = value || undefined;
                } else if (discountText.includes('£')) {
                    discountType = 'FIXED_OFF';
                    discountValue = this.extractPrice(discountText) || undefined;
                }

                // Extract voucher code
                const voucherCode = $el.find('.voucher-code, .promo-code').first().text().trim() || undefined;

                // Extract dates - use safe parsing
                const validUntilText = $el.find('.valid-until, .expires').first().text().trim();
                const endsAt = validUntilText ? this.parseDate(validUntilText) : null;

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    voucherCode,
                    endsAt: endsAt ? new Date(endsAt) : undefined,
                });
            } catch (error) {
                console.error('Error parsing Hoseasons offer:', error);
            }
        });

        return deals;
    }
}
