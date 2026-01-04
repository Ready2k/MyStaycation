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

    async search(params: SearchParams): Promise<PriceResult[]> {
        const results: PriceResult[] = [];

        // Use manual iteration over villages instead of BaseAdapter's single-URL patterns
        let villagesToSearch: string[] = [];
        if (params.region) {
            const code = this.getVillageCode(params.region);
            if (code) villagesToSearch.push(code);
        }

        if (villagesToSearch.length === 0) {
            // Default to all UK villages if no specific region
            villagesToSearch = ['WF', 'SF', 'LF', 'EF', 'WB'];
        }

        // Search villages sequentially to handle rate limiting
        for (const villageCode of villagesToSearch) {
            try {
                const url = this.buildVillageUrl(villageCode, params);
                console.log(`DEBUG: CenterParcs URL: ${url}`);

                // Use Playwright (headless browser) as Center Parcs likely uses JS for results
                const html = await this.fetchHtmlWithBrowser(url);

                if (!html) {
                    console.error(`❌ Center Parcs: Empty HTML returned for ${villageCode}`);
                    continue;
                }

                console.log(`DEBUG: CenterParcs: Fetched HTML length: ${html.length}`);
                const villageResults = this.parseVillageResults(html, villageCode, params);
                console.log(`DEBUG: CenterParcs ${villageCode}: Found ${villageResults.length} results`);

                results.push(...villageResults);

            } catch (error) {
                console.error(`❌ Center Parcs search failed for ${villageCode}:`, error);
            }
        }

        return results;
    }

    // --- Abstract Implementation Stubs (Not used for Search) ---

    protected buildSearchUrl(params: SearchParams): string {
        // Not used directly as we search multiple villages manualy
        return "";
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        // Not used directly
        return [];
    }

    async fetchOffers(): Promise<DealResult[]> {
        return []; // Not implemented yet
    }

    protected parseOffers(html: string): DealResult[] {
        return [];
    }

    protected buildOffersUrl(): string {
        return "https://www.centerparcs.co.uk/breaks-we-offer/last-minute-breaks.html";
    }

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
        const dogs = params.pets ? 1 : 0;
        const accessible = 0;
        const flex = 'N';

        return `https://www.centerparcs.co.uk/breaks-we-offer/search.html/2/${villageCode}/${dateStr}/${nights}/-/-/${lodges}/${adults}/${children}/${infants}/${dogs}/${accessible}/${flex}`;
    }

    private parseVillageResults(html: string, villageCode: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // Check for "No results found" text
        // Center Parcs usually says "Sorry, we found no availability"
        if (html.includes('Sorry, we found no')) {
            console.log(`DEBUG: CenterParcs ${villageCode} - No availability`);
            return [];
        }

        // Placeholder parsing logic:
        // We look for lodge items. 
        // Real parsing will need adjustment based on live HTML structure.
        $('.js-accommodation-item, .accommodation-item').each((i, el) => {
            const title = $(el).find('.accommodation-header').text().trim();
            const priceText = $(el).find('.accommodation-price').text().trim();

            // Extract price (e.g. "from £299")
            const priceMatch = priceText.match(/£([\d,]+)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

            if (price > 0) {
                results.push({
                    stayStartDate: params.dateWindow.start,
                    stayNights: params.nights.min || 4,
                    priceTotalGbp: price,
                    pricePerNightGbp: price / (params.nights.min || 4),
                    availability: 'AVAILABLE',
                    propertyName: title || `Lodge at ${villageCode}`,
                    sourceUrl: 'https://www.centerparcs.co.uk',
                    matchConfidence: MatchConfidence.STRONG,
                    location: villageCode
                });
            }
        });

        return results;
    }
}
