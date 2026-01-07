import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher } from '../utils/result-matcher';
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
        const url = this.buildSearchApiUrl(params, parkIdOverride);
        console.log('DEBUG: Hoseasons API URL:', url);

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'x-awaze-locale': 'en-GB', // REQUIRED header
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                console.error(`❌ Hoseasons API returned ${response.status}: ${response.statusText} for URL: ${url}`);
                return [];
            }

            const data: any = await response.json();
            return this.parseApiResponse(data, params, parkIdOverride);
        } catch (error) {
            console.error('❌ Hoseasons API call failed:', error);
            return [];
        }
    }

    /**
     * Build the Hoseasons search API URL
     */
    private buildSearchApiUrl(params: SearchParams, parkIdOverride?: string): string {
        const apiUrl = new URL(`${this.baseUrl}/api/search/properties/list`);

        // Add search parameters
        apiUrl.searchParams.append('adult', params.party.adults.toString());
        apiUrl.searchParams.append('child', (params.party.children || 0).toString());
        apiUrl.searchParams.append('infant', '0');
        apiUrl.searchParams.append('pets', params.pets ? '1' : '0');
        apiUrl.searchParams.append('range', '0'); // Exact dates
        apiUrl.searchParams.append('nights', params.nights.min.toString());
        apiUrl.searchParams.append('accommodationType', 'holiday-parks');

        // Priority: Specific Park ID > Region name
        if (parkIdOverride) {
            apiUrl.searchParams.append('placesId', parkIdOverride);
        } else if (params.region) {
            apiUrl.searchParams.append('regionName', params.region);
        }

        // Format date as DD-MM-YYYY
        const dateObj = new Date(params.dateWindow.start);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        apiUrl.searchParams.append('start', `${day}-${month}-${year}`);

        apiUrl.searchParams.append('page', '1');
        apiUrl.searchParams.append('sort', 'recommended');
        apiUrl.searchParams.append('displayMode', 'LIST');
        apiUrl.searchParams.append('index', 'search');
        apiUrl.searchParams.append('accommodationTypes', '');
        apiUrl.searchParams.append('features', '');
        apiUrl.searchParams.append('siteFeatures', '');
        apiUrl.searchParams.append('searchEngineVersion', 'v2');
        apiUrl.searchParams.append('brand', 'hoseasons');

        return apiUrl.toString();
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
            // Use 'domcontentloaded' instead of 'networkidle' to avoid timeout
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for the API response with polling
            console.log('⏳ Waiting for API response...');
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

            // Fallback: return the HTML if no API call was intercepted
            console.warn('⚠️  No API call intercepted, falling back to HTML');
            const html = await page.content();
            return html;

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

    protected buildSearchUrl(params: SearchParams): string {
        // Hoseasons URL structure - parameter order matters!
        const urlParams = new URLSearchParams();

        // Core parameters in the exact order from working manual URL:
        // adult, child, infant, pets, range, nights, accommodationType, regionName, start, page, sort, displayMode

        urlParams.append('adult', params.party.adults.toString());
        urlParams.append('child', (params.party.children || 0).toString());
        urlParams.append('infant', '0');
        urlParams.append('pets', params.pets ? '1' : '0');
        urlParams.append('range', '0'); // Exact dates
        urlParams.append('nights', params.nights.min.toString());
        urlParams.append('accommodationType', 'holiday-parks');

        // Region BEFORE date
        if (params.region) {
            urlParams.append('regionName', params.region);
        }

        // Format date as DD-MM-YYYY
        const dateObj = new Date(params.dateWindow.start);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        urlParams.append('start', `${day}-${month}-${year}`);

        urlParams.append('page', '1');
        urlParams.append('sort', 'recommended');
        urlParams.append('displayMode', 'LIST');

        return `${this.baseUrl}/search?${urlParams.toString()}`;
    }

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
                console.log(`DEBUG: Park Check - Filter: ${parkIdFilter}, property: ${JSON.stringify(property)}`);

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
