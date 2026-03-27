import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { MatchConfidence } from '../utils/result-matcher';
import { LocationNotFoundError } from '../utils/errors';

export class ForestHolidaysAdapter extends BaseAdapter {
    protected id = 'forestholidays';
    protected name = 'Forest Holidays';

    // Commonly known Forest Holidays locations
    private readonly LOCATIONS: Record<string, string> = {
        'ardgartan': '468bfc3f-c237-4d92-a99d-0c73face813a',
        'beddgelert': '49ae88aa-bee1-4941-8366-047e9d38a2d5',
        'blackwood': '4c774808-aeb5-4ed8-8b16-67bf66bfd117',
        'thorpe': '58d9ad0f-1e29-4b12-b85a-ab93b467283e',
        'forest of dean': '7123264d-f469-4332-8e31-95d59eb038d1',
        'deerpark': '8c1e4087-8f0a-496b-96c3-81643a9737f6',
        'strathyre': '8e473341-c16b-4f36-a779-e2d7f023cfbe',
        'cropton': '91ee8989-c3be-4377-8b74-48887adcc062',
        'keldy': 'c1581d0c-8b36-4859-832d-e70d6e8c1efb',
        'garwnant': 'd62c573b-dd69-4582-af9f-217cee647e1f',
        'sherwood': 'd701ccb7-b080-4f79-9870-8bac8a5c08ea',
        'delamere': 'db63a0ad-ff4d-4e84-9a9d-2cac0f5578f1',
        'glentress': 'eb77d895-d7d1-42fe-af4a-2635e86dc17c'
    };

    constructor() {
        super('https://www.forestholidays.co.uk', 'forestholidays');
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const results: PriceResult[] = [];
        let locationIds: string[] = [];

        // 1. Determine location IDs based on params
        if (params.parks && params.parks.length > 0) {
            locationIds = params.parks;
            console.log(`🎯 Searching specific Forest Holidays locations: ${locationIds.join(', ')}`);
        } else if (params.region) {
            const id = this.getLocationId(params.region);
            if (id) {
                locationIds = [id];
            } else {
                throw new LocationNotFoundError(params.region, 'forestholidays');
            }
        } else {
            // All known locations
            locationIds = Object.values(this.LOCATIONS);
            console.log(`🔍 Searching ALL Forest Holidays locations`);
        }

        // 2. Build URL and intercept payload
        try {
            const searchType = locationIds.length === 1 ? 'cabins' : 'locations';
            const url = this.buildSearchUrl(params, locationIds, searchType);
            
            console.log(`🔍 Navigating to ${searchType} search: ${url}`);
            
            const apiData = await this.interceptApiData(url, searchType);
            if (!apiData) {
                console.error(`❌ Forest Holidays: No API data intercepted`);
                return results;
            }

            const parsedResults = this.parseApiData(apiData, searchType, params);
            results.push(...parsedResults);

        } catch (error) {
            console.error(`❌ Forest Holidays search failed:`, error);
        }

        return results;
    }

    private async interceptApiData(url: string, searchType: 'cabins' | 'locations'): Promise<any> {
        const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
        if (!playwrightEnabled) {
            throw new Error('Playwright is disabled');
        }

        if (!this.browser) {
            const { chromium } = await import('playwright');
            this.browser = await chromium.launch({
                headless: true,
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            });
        }

        const page = await this.browser.newPage();

        try {
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            const targetEndpoint = searchType === 'cabins' ? 'flat-cabin-availability' : 'bookable-locations';
            
            const responsePromise = page.waitForResponse(response => 
                response.url().includes(targetEndpoint) && 
                response.request().method() === 'POST' &&
                response.status() === 200,
                { timeout: 60000 }
            ).catch(() => null);

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            console.log(`⏳ Waiting for Forest Holidays ${targetEndpoint} response...`);
            const response = await responsePromise;

            if (!response) {
                throw new Error('Failed to intercept API response');
            }

            console.log(`✅ Forest Holidays intercepted: ${response.url()}`);
            return await response.json();
        } finally {
            await page.close();
        }
    }

    private parseApiData(apiData: any, searchType: 'cabins' | 'locations', params: SearchParams): PriceResult[] {
        const results: PriceResult[] = [];
        const dateStr = params.dateWindow.start.replace(/\//g, '-'); // Expected YYYY-MM-DD
        const nights = params.nights.min;

        if (searchType === 'locations') {
            const locations = apiData?.data?.bookableLocations || [];
            locations.forEach((loc: any) => {
                if (!loc.minPrice || loc.minPrice <= 0) return;

                const price = loc.minPrice;
                const perNight = this.calculatePricePerNight(price, nights);

                if (perNight) {
                    results.push({
                        stayStartDate: params.dateWindow.start, // Format correctly based on input
                        stayNights: nights,
                        priceTotalGbp: price,
                        pricePerNightGbp: perNight,
                        availability: 'AVAILABLE',
                        accomType: 'Cabin / Lodge (From)',
                        propertyName: `${loc.locationName} (Lowest Price)`,
                        sourceUrl: this.buildSearchUrl(params, [loc.id], 'cabins'),
                        matchConfidence: MatchConfidence.STRONG,
                        parkId: loc.id,
                        location: loc.locationName,
                        bedrooms: params.party.adults > 2 ? 2 : 1, // Estimate if minimal data
                        metadata: {
                            maxPrice: loc.maxPrice
                        }
                    });
                }
            });
        } else {
            // cabins search
            const cabins = apiData?.data?.flatCabinAvailability?.cabinPanels || 
                           apiData?.data?.cabinAvailability?.cabins ||
                           apiData?.data?.flatCabinAvailability || [];
            
            const list = Array.isArray(cabins) ? cabins : (cabins.cabinPanels || []);
            
            list.forEach((cabinInfo: any) => {
                const cabin = cabinInfo;
                const petFree = cabin.petFreeBedroomOptions || [];
                const petFriendly = cabin.petFriendlyBedroomOptions || [];
                const all = cabin.allBedroomOptions || [];
                
                const allOptions = [...petFree, ...petFriendly, ...all];
                
                allOptions.forEach((option: any) => {
                    const price = option.postDiscountPrice || option.cabinSellingPrice || option.price || option.minPrice;
                    if (!price || price <= 0 || option.isAvailable === false) return;

                    const perNight = option.pricePerNight || this.calculatePricePerNight(price, nights);
                    if (perNight) {
                        results.push({
                            stayStartDate: params.dateWindow.start,
                            stayNights: nights,
                            priceTotalGbp: price,
                            pricePerNightGbp: perNight,
                            availability: 'AVAILABLE',
                            accomType: `${cabin.cabinTypeName || 'Cabin'} (${option.numberOfBedrooms} Bed)`,
                            propertyName: `${cabin.cabinTypeName || 'Cabin'} (${option.numberOfBedrooms} Bed)`,
                            sourceUrl: this.buildSearchUrl(params, params.parks || [], 'cabins'),
                            matchConfidence: MatchConfidence.STRONG,
                            parkId: params.parks ? params.parks[0] : (cabin.locationId || 'unknown'),
                            location: cabin.locationName || 'Forest Holidays',
                            bedrooms: option.numberOfBedrooms,
                            metadata: {
                                tier: cabin.cabinType,
                                isPetFriendly: option.isPetFriendly,
                                promoName: cabin.promoName
                            }
                        });
                    }
                });
            });
        }

        return results;
    }

    protected buildSearchUrl(params: SearchParams, locationIds: string[] = [], searchType: 'cabins' | 'locations' = 'locations'): string {
        const locations = locationIds.join('%2C');
        const d = params.nights.min || 7;
        const sd = params.dateWindow.start.replace(/-/g, '%2F'); // API uses YYYY/MM/DD escaped as YYYY%2FMM%2FDD
        const a = params.party.adults || 2;
        const c = params.party.children || 0;
        const i = 0; // infants
        const p = params.pets || 0;
        // b = bedrooms (try matching adults + kids minimally)
        let b = 1;
        if ((a + c) > 2) b = 2;
        if ((a + c) > 4) b = 3;
        if ((a + c) > 6) b = 4;
        
        // Example: https://www.forestholidays.co.uk/booking/locations/?l=UUIDs...&d=7&sd=2026%2F08%2F17&a=2&b=1&c=1&i=1&p=2&dda=false
        return `${this.baseUrl}/booking/${searchType}/?l=${locations}&d=${d}&sd=${sd}&a=${a}&b=${b}&c=${c}&i=${i}&p=${p}&dda=false`;
    }

    private getLocationId(region: string): string | null {
        const normalized = region.toLowerCase().trim();
        for (const [name, id] of Object.entries(this.LOCATIONS)) {
            if (normalized.includes(name) || name.includes(normalized)) return id;
        }
        return null;
    }

    async fetchOffers(): Promise<DealResult[]> {
        return []; // To be implemented later if needed
    }

    protected parseOffers(_html: string): DealResult[] { return []; }
    protected parseSearchResults(_html: string, _params: SearchParams): PriceResult[] { return []; }
    protected buildOffersUrl(): string { return `${this.baseUrl}/offers/`; }
}
