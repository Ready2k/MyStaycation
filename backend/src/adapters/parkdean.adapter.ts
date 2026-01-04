import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export class ParkdeanAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.PARKDEAN_BASE_URL || 'https://www.parkdeanresorts.co.uk',
            'parkdean'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        if (!this.isEnabled()) {
            console.log('⚠️  Parkdean adapter is disabled');
            return [];
        }

        const url = this.buildSearchUrl(params);
        console.log(`🌐 Parkdean: Searching URL: ${url}`);

        try {
            // We use the browser here because Parkdean likely uses client-side rendering (React/Vue/etc)
            // or rigorous bot protection that a simple fetch might fail against.
            const html = await this.fetchHtmlWithBrowser(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.error('❌ Parkdean search failed:', error);
            return [];
        }
    }

    async fetchOffers(): Promise<DealResult[]> {
        if (!this.isEnabled()) {
            return [];
        }

        const url = this.buildOffersUrl();
        try {
            const html = await this.fetchHtmlWithBrowser(url);
            return this.parseOffers(html);
        } catch (error) {
            console.error('Failed to fetch Parkdean offers:', error);
            return [];
        }
    }

    protected buildSearchUrl(params: SearchParams): string {
        const urlParams = new URLSearchParams();

        // Based on observed URL: https://www.parkdeanresorts.co.uk/search-results/?adults=2
        // We need to map our SearchParams to Parkdean's expected query params.

        // Party size
        urlParams.append('adults', params.party.adults.toString());
        if (params.party.children) {
            urlParams.append('children', params.party.children.toString());
        }

        // Date
        // Helper to format date as DD/MM/YYYY if needed, or YYYY-MM-DD. 
        // Most UK sites use DD/MM/YYYY or YYYY-MM-DD. Let's try standard YYYY-MM-DD first or verify.
        // Looking at the Hoseasons adapter, they used DD-MM-YYYY. Parkdean often uses DD/MM/YYYY.
        const dateObj = new Date(params.dateWindow.start);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        urlParams.append('arriving', `${day}/${month}/${year}`);

        // Duration
        urlParams.append('nights', params.nights.min.toString());

        // Location/Region
        if (params.region) {
            urlParams.append('region', params.region);
        }

        // Pets
        if (params.pets) {
            urlParams.append('pets', '1');
        }

        return `${this.baseUrl}/search-results/?${urlParams.toString()}`;
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/holidays/offers/`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // Selectors need to be verified against actual DOM. 
        // Broad selectors for now:
        $('.search-result, .holiday-card, .result-item').each((_, element) => {
            try {
                const $el = $(element);

                // Title/Name
                const propertyName = $el.find('.property-name, h3, .title').first().text().trim();

                // Price
                const priceText = $el.find('.price, .total-price, .cost').first().text().trim();
                const priceTotalGbp = this.extractPrice(priceText);

                if (!priceTotalGbp) return;

                // Park/Location
                const location = $el.find('.location, .region').first().text().trim();
                // Extract Link/Park ID from URL
                const link = $el.find('a').attr('href');
                let parkId: string | undefined;
                if (link) {
                    // unexpected format checks
                    const match = link.match(/\/([^/]+)\/$/);
                    if (match) parkId = match[1];
                }

                // Availability - if it's in results, it's likely available
                const availability = 'AVAILABLE';

                // Accommodation Type
                const accomType = 'holiday-park'; // Default

                // Normalize link
                const sourceUrl = this.normalizeUrl(link);

                // Dates & Nights (often not explicit in card if it matches search, but good to check)
                const stayStartDate = params.dateWindow.start;
                const stayNights = params.nights.min;

                // Per night calc
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights);

                if (!pricePerNightGbp) return;

                // Match Details
                const candidateRes = {
                    stayStartDate,
                    stayNights,
                    priceTotalGbp,
                    availability: 'AVAILABLE' as const,
                    accomType,
                    bedrooms: params.minBedrooms, // assumption if not scraped
                    petsAllowed: params.pets // assumption
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
                    availability,
                    accomType,
                    sourceUrl,
                    matchConfidence: matchResult.confidence,
                    matchDetails: matchResult.description,
                    propertyName,
                    location,
                    parkId
                });

            } catch (e) {
                console.warn('Failed to parse a Parkdean result item', e);
            }
        });

        console.log(`✅ Parsed ${results.length} results from Parkdean HTML`);
        return results;
    }

    protected parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const deals: DealResult[] = [];

        $('.offer-item, .deal-card, .promo-banner').each((_, element) => {
            try {
                const $el = $(element);
                const title = $el.find('.title, h3, h4').first().text().trim();
                const desc = $el.find('.description, p').first().text().trim();

                if (!title) return;

                const fullText = (title + ' ' + desc).toLowerCase();

                // Heuristic Parsing
                let discountType: DealResult['discountType'] = 'PERK';
                let discountValue: number | undefined;

                // Look for percentages
                const percentMatch = fullText.match(/(\d+)%\s*off/);
                if (percentMatch) {
                    discountType = 'PERCENT_OFF';
                    discountValue = parseInt(percentMatch[1], 10);
                }
                // Look for money off
                else if (fullText.includes('save') && fullText.includes('£')) {
                    const value = this.extractPrice(fullText);
                    if (value) {
                        discountType = 'FIXED_OFF';
                        discountValue = value;
                    }
                }

                // Check dates (e.g. "Expires 31/01")
                // Simple regex for DD/MM
                const dateMatch = fullText.match(/expires\s+(\d{1,2}\/\d{1,2})/);
                let endsAt: Date | undefined;
                if (dateMatch) {
                    const [d, m] = dateMatch[1].split('/').map(Number);
                    const now = new Date();
                    endsAt = new Date(now.getFullYear(), m - 1, d);
                    // Handle year wrap
                    if (endsAt < now) {
                        endsAt.setFullYear(now.getFullYear() + 1);
                    }
                }

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    endsAt
                });

            } catch (error) {
                console.warn('Error parsing Parkdean offer item:', error);
            }
        });

        return deals;
    }
}
