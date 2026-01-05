import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import * as cheerio from 'cheerio';
import { MatchConfidence } from '../utils/result-matcher';

export class CenterParcsAdapter extends BaseAdapter {
    protected id = 'centerparcs';
    protected name = 'Center Parcs';

    // Village Codes mapping
    private readonly VILLAGES: Record<string, string> = {
        'whinfell': 'WF',
        'sherwood': 'SF',
        'longleat': 'LF',
        'elveden': 'EF',
        'woburn': 'WB',
        'longford': 'EI'
    };

    constructor() {
        super('https://www.centerparcs.co.uk', 'centerparcs');
    }

    /**
     * Custom Playwright fetch for Center Parcs with API interception
     */
    private async fetchCenterParcsWithBrowser(url: string, villageCode: string): Promise<any> {
        const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
        if (!playwrightEnabled) {
            throw new Error('Playwright is disabled');
        }

        if (!this.browser) {
            console.log('Starting Playwright browser...');
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
            console.log('Playwright browser started.');
        }

        const page = await this.browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'Accept': 'application/json, text/plain, */*',
            }
        });

        // Log page console messages
        page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));

        let interceptedData: any = null;

        try {
            // Intercept API calls
            page.on('response', async (response) => {
                const responseUrl = response.url();
                // Log all relevant JSON responses to see what we're getting
                if (responseUrl.includes('centerparcs.co.uk') && responseUrl.includes('json')) {
                    console.log(`Response: ${responseUrl} (${response.status()})`);
                }

                if (responseUrl.includes('/api/v1/accommodation.json')) {
                    try {
                        const json = await response.json();
                        console.log(`🎯 CenterParcs: Intercepted API response for ${villageCode} (Size: ${JSON.stringify(json).length})`);
                        interceptedData = json;
                    } catch (e) {
                        console.error(`Error parsing JSON for ${responseUrl}:`, e);
                    }
                }
            });

            console.log(`🌐 CenterParcs: Navigating to ${url}`);
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); // Increased timeout

            // Wait a bit extra to ensure API calls finish
            await page.waitForTimeout(5000);

            return interceptedData;

        } catch (error) {
            console.error(`❌ CenterParcs Browser Error for ${villageCode}:`, error);
            if (interceptedData) {
                console.log(`⚠️ CenterParcs: Returning intercepted data despite error`);
                return interceptedData;
            }
            return null;
        } finally {
            await page.close();
        }
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const results: PriceResult[] = [];

        // Use manual iteration over villages
        let villagesToSearch: string[] = [];
        if (params.region) {
            const code = this.getVillageCode(params.region);
            if (code) villagesToSearch.push(code);
        }

        if (villagesToSearch.length === 0) {
            villagesToSearch = ['WF', 'SF', 'LF', 'EF', 'WB'];
        }

        for (const villageCode of villagesToSearch) {
            try {
                const url = this.buildVillageUrl(villageCode, params);
                console.log(`DEBUG: CenterParcs URL: ${url}`);

                // Use custom fetcher to intercept JSON
                const apiData = await this.fetchCenterParcsWithBrowser(url, villageCode);

                if (!apiData) {
                    console.error(`❌ Center Parcs: No API data intercepted for ${villageCode}`);
                    continue;
                }

                const villageResults = this.parseApiResults(apiData, villageCode, params);
                console.log(`DEBUG: CenterParcs ${villageCode}: Found ${villageResults.length} results`);

                results.push(...villageResults);

            } catch (error) {
                console.error(`❌ Center Parcs search failed for ${villageCode}:`, error);
            }
        }

        return results;
    }

    private parseApiResults(data: any, villageCode: string, params: SearchParams): PriceResult[] {
        const results: PriceResult[] = [];
        let items: any[] = [];

        // Handle nested structure: data.data.accommodation.accommodationList
        if (data?.data?.accommodation?.accommodationList) {
            items = data.data.accommodation.accommodationList;
        } else if (data?.accommodation) {
            items = Array.isArray(data.accommodation) ? data.accommodation : [];
        }

        console.log(`DEBUG: Found ${items.length} items in JSON`);

        if (items.length > 0) {
            // DEBUG: Log first item to see structure
            if (items[0].availabilities) console.log('DEBUG: Availabilities:', JSON.stringify(items[0].availabilities).substring(0, 500));
        } else {
            // Fallback: If structure is different or empty, log context
            console.log('DEBUG: Unexpected or empty CP JSON structure:', JSON.stringify(data).substring(0, 500));
        }

        items.forEach((item: any) => {
            try {
                // Item might wrap 'lodge' and 'price'
                // Check if properties are on item or item.lodge
                const lodge = item.lodge || item;

                // Extract Price
                // Look for price in availabilities
                let price: number | undefined;

                if (item.availabilities && Array.isArray(item.availabilities) && item.availabilities.length > 0) {
                    // Check price in first availability
                    // Structure might be availabilities[0].price.amount or similar
                    const firstAvail = item.availabilities[0];
                    // Handle both object {amount: 100} and number 100
                    if (typeof firstAvail.price === 'number') {
                        price = firstAvail.price;
                    } else {
                        price = firstAvail.price?.amount || firstAvail.displayPrice;
                    }
                }

                // Fallback to old locations
                if (!price) {
                    price = item.price?.amount || item.displayPrice;
                }

                // Sometimes price is in a 'price' object on the item
                if (!price && item.price && typeof item.price === 'object') {
                    price = item.price.amount;
                }

                if (!price) return;


                // Extract Title
                const propertyName = lodge.title || lodge.name || lodge.displayName;

                // Extract Beds
                let bedrooms: number | undefined;
                if (lodge.bedrooms) bedrooms = lodge.bedrooms;

                if (!bedrooms && propertyName) {
                    // Fallback based on name (e.g. "3 Bedroom Woodland Lodge")
                    const nameMatch = propertyName.match(/(\d+)\s*Bed/i);
                    if (nameMatch) bedrooms = parseInt(nameMatch[1]);
                }

                results.push({
                    stayStartDate: params.dateWindow.start,
                    stayNights: params.nights.min || 4,
                    priceTotalGbp: typeof price === 'string' ? parseFloat(price) : price,
                    pricePerNightGbp: (typeof price === 'string' ? parseFloat(price) : price) / (params.nights.min || 4),
                    availability: 'AVAILABLE',
                    propertyName: propertyName || `Lodge at ${villageCode}`,
                    sourceUrl: 'https://www.centerparcs.co.uk',
                    matchConfidence: MatchConfidence.STRONG,
                    location: villageCode,
                    parkId: villageCode, // Critical for SeriesKey
                    bedrooms: bedrooms,
                    accomType: item.type || 'Lodge',
                    petsAllowed: params.pets // Default to what we asked for, refined if API has data
                });
            } catch (e) {
                console.error('Error parsing CP item:', e);
            }
        });

        return results;
    }

    // --- Abstract Implementation Stubs (Not used for Search) ---

    protected buildSearchUrl(params: SearchParams): string { return ""; }
    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] { return []; }
    async fetchOffers(): Promise<DealResult[]> { return []; }
    protected parseOffers(html: string): DealResult[] { return []; }
    protected buildOffersUrl(): string { return "https://www.centerparcs.co.uk/breaks-we-offer/last-minute-breaks.html"; }

    // --- Implementation Details ---

    private getVillageCode(region: string): string | null {
        const normalized = region.toLowerCase().trim();
        if (Object.values(this.VILLAGES).includes(normalized.toUpperCase())) {
            return normalized.toUpperCase();
        }
        for (const [name, code] of Object.entries(this.VILLAGES)) {
            if (normalized.includes(name)) return code;
        }
        return null;
    }

    private buildVillageUrl(villageCode: string, params: SearchParams): string {
        // format: /breaks-we-offer/search.html/2/{VILLAGE}/{DD-MM-YYYY}/{NIGHTS}/-/-/{LODGES}/{ADULTS}/{CHILDREN}/{INFANTS}/{DOGS}/{ACCESSIBLE}/{FLEX?}

        const date = new Date(params.dateWindow.start);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const dateStr = `${day}-${month}-${year}`;

        const nights = params.nights.min || 4;
        const lodges = 1;
        const adults = params.party.adults || 2;
        const children = params.party.children || 0;
        const infants = 0;
        // Note: Dog logic per URL provided by user seems to put dogs at index 8? 
        // /2/SF/11-05-2026/4/-/-/1/2/0/0/0/0/N
        // 1=lodges, 2=adults, 0=children, 0=infants, 0=dogs?
        const dogs = params.pets ? 1 : 0;
        const accessible = 0;
        const flex = 'N';

        return `https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/${villageCode}/${dateStr}/${nights}/-/-/${lodges}/${adults}/${children}/${infants}/${dogs}/${accessible}/${flex}`;
    }
}
