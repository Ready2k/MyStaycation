import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { chromium, Browser } from 'playwright';
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
        'woburn': 'WO', // Corrected from WB
        'longford': 'EI'
    };

    constructor() {
        super('https://www.centerparcs.co.uk', 'centerparcs');
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const results: PriceResult[] = [];

        // Determine which villages to search
        let villagesToSearch: string[] = [];

        // Priority 1: Use params.parks if specified (from profile parkIds)
        if (params.parks && params.parks.length > 0) {
            villagesToSearch = params.parks;
            console.log(`🎯 Searching specific Center Parcs villages: ${villagesToSearch.join(', ')}`);
        }
        // Priority 2: Use region if specified
        else if (params.region) {
            const code = this.getVillageCode(params.region);
            if (code) villagesToSearch.push(code);
        }
        // Priority 3: Default to all UK villages
        else {
            villagesToSearch = ['WF', 'SF', 'LF', 'EF', 'WO'];
            console.log(`🔍 No specific villages selected, searching all Center Parcs`);
        }

        // Search villages sequentially
        for (const villageCode of villagesToSearch) {
            try {
                const url = this.buildVillageUrl(villageCode, params);
                console.log(`DEBUG: CenterParcs URL: ${url}`);

                // Use API interception to get accommodation data
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

    /**
     * Normalize date to YYYY-MM-DD format for comparison
     */
    private normalizeDate(dateStr: string): string {
        if (!dateStr) return '';

        // If already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // If in DD-MM-YYYY format (Center Parcs API format)
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month}-${day}`;
        }

        // Try parsing as Date object
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        return dateStr; // Return as-is if can't parse
    }

    /**
     * Fetch Center Parcs page and intercept API data
     */
    private async fetchCenterParcsWithBrowser(url: string, villageCode: string): Promise<any> {
        const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
        if (!playwrightEnabled) {
            throw new Error('Playwright is disabled');
        }

        if (!this.browser) {
            const { chromium } = await import('playwright');
            this.browser = await chromium.launch({
                headless: true,
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }

        const page = await this.browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
        });

        let interceptedData: any = null;

        try {
            // Intercept API response
            page.on('response', async (response) => {
                const responseUrl = response.url();
                const method = response.request().method();

                // Intercept the accommodation POST request
                if (responseUrl.includes('/api/v1/accommodation.json') && method === 'POST') {
                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            interceptedData = await response.json();
                            console.log(`✅ CenterParcs: Intercepted accommodation data (${JSON.stringify(interceptedData).length} bytes)`);
                        }
                    } catch (e) {
                        console.error(`Error parsing accommodation JSON:`, e);
                    }
                }
            });

            console.log(`🌐 CenterParcs: Navigating to ${url}`);

            // Use networkidle to trigger the API call, but handle timeout gracefully
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
            } catch (error: any) {
                // Timeout is expected - the page never reaches true networkidle
                // But the API data should have been intercepted before timeout
                if (error.message?.includes('Timeout') && interceptedData) {
                    console.log(`⚠️ CenterParcs: Timeout waiting for networkidle (expected), but data was intercepted`);
                } else if (error.message?.includes('Timeout')) {
                    console.warn(`⚠️ CenterParcs: Timeout and no data intercepted`);
                } else {
                    throw error;
                }
            }

            return interceptedData;

        } catch (error) {
            console.error(`❌ CenterParcs Browser Error for ${villageCode}:`, error);
            return interceptedData; // Return any data we managed to intercept
        } finally {
            await page.close();
        }
    }

    /**
     * Parse API results
     */
    private parseApiResults(data: any, villageCode: string, params: SearchParams): PriceResult[] {
        const results: PriceResult[] = [];
        let items: any[] = [];

        // Handle nested structure: data.data.accommodation.accommodationList
        if (data?.data?.accommodation?.accommodationList) {
            items = data.data.accommodation.accommodationList;
        } else if (data?.accommodations) {
            items = Array.isArray(data.accommodations) ? data.accommodations : [];
        }

        console.log(`DEBUG: Found ${items.length} items in JSON`);

        const searchDateStr = params.dateWindow.start; // Format: YYYY-MM-DD
        const searchNights = params.nights.min;

        console.log(`DEBUG: Searching for date: ${searchDateStr}, nights: ${searchNights}`);

        items.forEach((item: any, index: number) => {
            try {
                // Debug first item structure
                if (index === 0) {
                    console.log(`DEBUG: Item keys: ${Object.keys(item).join(', ')}`);
                    if (item.availabilities?.[0]) {
                        console.log(`DEBUG: First availability: arrivalDate=${item.availabilities[0].arrivalDate}, duration=${item.availabilities[0].duration}, price=${item.availabilities[0].price}`);
                    }
                    console.log(`DEBUG: Total availabilities for first item: ${item.availabilities?.length || 0}`);
                }

                // Get lodge information
                // Debug raw name access
                if (index === 0) {
                    console.log(`DEBUG: item.lodge keys: ${item.lodge ? Object.keys(item.lodge).join(', ') : 'undefined'}`);
                    console.log(`DEBUG: item.lodge.title value: '${item.lodge?.title}'`);
                }

                // Use title or shortTitle as the name (API uses 'title' not 'name')
                const lodgeName = item.lodge?.title || item.lodge?.shortTitle || item.name || 'Lodge';
                const lodgeBedrooms = item.lodge?.bedrooms || item.bedrooms || item.lodge?.numberOfBedrooms;

                if (index === 0) {
                    console.log(`DEBUG: Resolved lodgeName: '${lodgeName}'`);
                }

                // Center Parcs API returns multiple dates (week before/after) for price comparison
                // We need to filter to the exact search date
                if (!item.availabilities || !Array.isArray(item.availabilities) || item.availabilities.length === 0) {
                    return;
                }

                // Filter to exact date match
                const matchingAvailabilities = item.availabilities.filter((avail: any) => {
                    const availDate = avail.arrivalDate; // Format: DD-MM-YYYY
                    const availDuration = avail.duration;

                    // Normalize both dates to YYYY-MM-DD for comparison
                    const normalizedAvailDate = this.normalizeDate(availDate);
                    const normalizedSearchDate = this.normalizeDate(searchDateStr);

                    const dateMatch = normalizedAvailDate === normalizedSearchDate;
                    const durationMatch = availDuration === searchNights;

                    if (index === 0 && !dateMatch) {
                        console.log(`DEBUG: Date mismatch for ${lodgeName}: availDate=${availDate} (${normalizedAvailDate}) != searchDate=${searchDateStr} (${normalizedSearchDate})`);
                    }
                    if (index === 0 && dateMatch && !durationMatch) {
                        console.log(`DEBUG: Duration mismatch for ${lodgeName}: availDuration=${availDuration} != searchNights=${searchNights}`);
                    }

                    return dateMatch && durationMatch;
                });

                if (matchingAvailabilities.length === 0) {
                    if (index === 0) {
                        console.log(`DEBUG: No matching availabilities for ${lodgeName} - searched ${searchDateStr} for ${searchNights} nights but got availabilities for: ${item.availabilities.map((a: any) => `${a.arrivalDate} (${a.duration} nights)`).join(', ')}`);
                    }
                    return;
                }

                const availability = matchingAvailabilities[0];

                // Extract price and metadata
                let price: number | undefined;
                if (typeof availability.price === 'number') {
                    price = availability.price;
                } else if (availability.displayPrice && typeof availability.displayPrice === 'number') {
                    price = availability.displayPrice;
                } else if (availability.price?.amount) {
                    price = availability.price.amount;
                }

                if (!price || price <= 0) {
                    return;
                }

                // Extract additional metadata
                const isLowestPrice = availability.isLowestPrice === true;
                const availableRooms = availability.availableRooms || availability.roomsLeftFormattedMessage;

                // Debug for first item
                if (index === 0) {
                    console.log(`DEBUG: isLowestPrice: ${isLowestPrice}, availableRooms: ${availableRooms}`);
                }

                // Parse the actual arrival date from API (format: DD-MM-YYYY)
                const arrivalDateStr = availability.arrivalDate;
                const actualDate = this.normalizeDate(arrivalDateStr);
                const actualNights = availability.duration;

                // Build proper URL with the date from the API
                // Format: /2/{location}/{date}/{duration}/-/-/{rooms}/{adults}/{children}/{toddlers}/{infants}/{dogs}/{adaptiveLodge}
                const rooms = Math.ceil(params.party.adults / 2); // 1-2 adults = 1 room, 3-4 adults = 2 rooms, etc.
                const sourceUrl = `https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/${villageCode}/${arrivalDateStr}/${actualNights}/-/-/${rooms}/${params.party.adults}/${params.party.children}/0/0/0/N`;

                if (index === 0) {
                    console.log(`DEBUG: URL params - adults: ${params.party.adults}, children: ${params.party.children}, rooms: ${rooms}`);
                    console.log(`DEBUG: Generated URL: ${sourceUrl}`);
                }

                const pricePerNightGbp = this.calculatePricePerNight(price, actualNights);

                if (!pricePerNightGbp) return;

                results.push({
                    stayStartDate: actualDate, // YYYY-MM-DD format
                    stayNights: actualNights,
                    priceTotalGbp: price,
                    pricePerNightGbp,
                    availability: 'AVAILABLE',
                    accomType: lodgeName,
                    propertyName: lodgeName,
                    sourceUrl,
                    matchConfidence: MatchConfidence.EXACT,
                    matchDetails: isLowestPrice ? 'Lowest price' : 'API data',
                    parkId: villageCode,
                    location: villageCode,
                    bedrooms: lodgeBedrooms,
                    metadata: {
                        isLowestPrice,
                        availableRooms: availableRooms ? String(availableRooms) : undefined
                    }
                });

                console.log(`DEBUG: Added result #${results.length}: ${lodgeName} - £${price} (date: ${arrivalDateStr} -> ${actualDate}, nights: ${actualNights}, lowest: ${isLowestPrice})`);
            } catch (error) {
                console.error(`Error parsing accommodation:`, error);
            }
        });

        return results;
    }

    // --- Abstract Implementation Stubs ---

    protected buildSearchUrl(params: SearchParams): string {
        return "";
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        return [];
    }

    async fetchOffers(): Promise<DealResult[]> {
        return [];
    }

    protected parseOffers(html: string): DealResult[] {
        return [];
    }

    protected buildOffersUrl(): string {
        return "https://www.centerparcs.co.uk/breaks-we-offer/last-minute-breaks.html";
    }

    // --- Helper Methods ---

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
        const date = new Date(params.dateWindow.start);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const dateStr = `${day}-${month}-${year}`;

        const nights = params.nights.min || 4;
        const adults = params.party.adults || 2;
        const children = params.party.children || 0;
        const rooms = Math.ceil(adults / 2); // 1-2 adults = 1 room, 3-4 adults = 2 rooms
        const infants = 0;
        const toddlers = 0;
        const dogs = params.pets ? 1 : 0;
        const accessible = 0;
        const flex = 'N';

        // Format: /2/{location}/{date}/{duration}/-/-/{rooms}/{adults}/{children}/{toddlers}/{infants}/{dogs}/{adaptiveLodge}
        return `https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/${villageCode}/${dateStr}/${nights}/-/-/${rooms}/${adults}/${children}/${toddlers}/${infants}/${dogs}/${flex}`;
    }
}
