/// <reference lib="dom" />
import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher, MatchConfidence } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

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
        // [MODIFIED] Use Search Page URL instead of API URL to bypass WAF
        const url = this.buildSearchUrl(params, parkIdOverride);
        console.log('DEBUG: Hoseasons Search URL:', url);

        try {
            // [MODIFIED] Use Browser Fetch instead of direct API fetch
            let rawResult: string;
            try {
                rawResult = await this.fetchHoseasonsWithBrowser(url);
            } catch (e) {
                console.error('Browser fetch failed:', e);
                return [];
            }

            const parsed = JSON.parse(rawResult);
            if (parsed.interceptedData) {
                return this.parseApiResponse(parsed.interceptedData, params, parkIdOverride);
            } else if (parsed.scrapedData) {
                return this.parseScrapedResults(parsed.scrapedData, params);
            }

            return [];
        } catch (error) {
            console.error('❌ Hoseasons search failed:', error);
            return [];
        }
    }

    private parseScrapedResults(scrapedData: any[], params: SearchParams): PriceResult[] {
        return scrapedData.map(item => {
            // Parse price string "£123" -> 123
            const priceVal = parseFloat(item.price.replace(/[£,]/g, ''));

            // Map scanned fields to PriceResult interface
            return {
                stayStartDate: params.dateWindow.start,
                stayNights: params.nights.min,
                priceTotalGbp: priceVal,
                pricePerNightGbp: this.calculatePricePerNight(priceVal, params.nights.min) || 0,
                availability: 'AVAILABLE',
                accomType: 'holiday-park',
                sourceUrl: this.normalizeUrl(item.deepLink),
                matchConfidence: MatchConfidence.STRONG, // Assumed if on page

                // Real-world fields
                propertyName: item.name,
                location: item.region || params.region || 'Unknown',
                bedrooms: Math.ceil((params.party.adults || 2) / 2),
                petsAllowed: params.pets
            };
        });
    }

    /**
     * Map common region names to Hoseasons-specific ones
     */
    /**
     * Map region name to Hoseasons URL slug
     * e.g. "Kielder Lakes" -> "northumberland"
     */
    private getRegionSlug(region: string): string {
        if (!region) return '';

        const lower = region.toLowerCase().trim();

        // Specific Mappings based on verification
        if (lower.includes('kielder') || lower === 'northumberland') {
            return 'northumberland';
        }

        if (lower === 'kendal' || lower === 'lake district' || lower === 'lakes' || lower === 'cumbria') {
            return 'cumbria';
        }

        if (lower === 'cornwall') {
            return 'cornwall';
        }

        if (lower === 'devon') {
            return 'devon';
        }

        if (lower === 'yorkshire') {
            return 'yorkshire';
        }

        // Default: generic slugification
        return lower.replace(/[^a-z0-9]+/g, '-');
    }

    /**
     * Build the Hoseasons search URL using path-based routing
     * e.g. https://www.hoseasons.co.uk/holiday-parks/cornwall?checks...
     */
    protected buildSearchUrl(params: SearchParams, parkIdOverride?: string): string {
        const urlParams = new URLSearchParams();

        urlParams.append('adult', params.party.adults.toString());
        urlParams.append('child', (params.party.children || 0).toString());
        urlParams.append('infant', '0');
        urlParams.append('pets', params.pets ? '1' : '0');
        urlParams.append('range', '0');
        urlParams.append('nights', params.nights.min.toString());
        urlParams.append('accommodationType', 'holiday-parks');

        // Format date
        const dateObj = new Date(params.dateWindow.start);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        urlParams.append('start', `${day}-${month}-${year}`);

        urlParams.append('page', '1');
        urlParams.append('sort', 'recommended');
        urlParams.append('displayMode', 'LIST');

        // Base URL construction
        let basePath = '/search'; // Fallback

        if (params.region) {
            const slug = this.getRegionSlug(params.region);
            if (slug) {
                basePath = `/holiday-parks/${slug}`;
            } else {
                // Fallback if no region (rare)
                // urlParams.append('regionName', ...); // Deprecated
            }
        }

        return `${this.baseUrl}${basePath}?${urlParams.toString()}`;
    }

    /**
     * Custom Playwright fetch for Hoseasons with API interception
     */
    private async fetchHoseasonsWithBrowser(url: string): Promise<string> {
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
            let scrapedResults = await page.evaluate(() => {
                const results = [];
                // Strategy 1: Price-First (Works for Search Page)
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                const priceNodes = [];
                while (node = walker.nextNode()) {
                    if (node.textContent && node.textContent.includes('£') && /\d/.test(node.textContent)) {
                        priceNodes.push(node.parentElement);
                    }
                }

                const seenContainers = new Set();
                const priceFirstResults = [];

                for (const priceEl of priceNodes) {
                    let container = priceEl;
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

                            if (maxVal > 0) {
                                priceFirstResults.push({
                                    name: name,
                                    region: location,
                                    price: bestPrice,
                                    deepLink: container.querySelector('a')?.href || ''
                                });
                            }
                            break;
                        }
                        container = container.parentElement;
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
                        headerResults.push({
                            name: (header as HTMLElement).innerText.split('\n')[0], // simple clean
                            region: 'Derived from Search', // Context is lost but region is known from params
                            price: bestPrice,
                            deepLink: deepLink
                        });
                    }
                }

                return headerResults;
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

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
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
