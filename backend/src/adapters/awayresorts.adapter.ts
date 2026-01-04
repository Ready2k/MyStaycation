
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import * as cheerio from 'cheerio';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export class AwayResortsAdapter extends BaseAdapter {
    constructor() {
        super('https://www.awayresorts.co.uk', 'awayresorts');
    }

    protected getResortCode(query: string): string {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const q = normalize(query);

        const resorts: Record<string, string> = {
            'tattershall': '7',
            'tattershalllakes': '7',
            'sandyballs': '1',
            'millrythe': '18',
            'whitecliff': '15',
            'whitecliffbay': '15',
            'merseaisland': '12',
            'barmouthbay': '20',
            'cleethorpes': '17',
            'cleethorpespearl': '17',
            'goldensands': '21',
            'stives': '23',
            'stivesbay': '23',
            'newquay': '24',
            'newquaybay': '24',
            'retallack': '19',
            'rookley': '13',
            'thelakesrookley': '13',
            'colwell': '14',
            'thebaycolwell': '14',
            'bostonwest': '26',
            'eastfleet': '27',
            'glendorgal': '28',
            'gara': '25',
            'gararock': '25'
        };

        // Default to Tattershall Lakes if not found or empty
        return resorts[q] || '7';
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const url = this.buildSearchUrl(params);
        console.log(`Fetching search results from: ${url}`);

        // Away Resorts is an SPA/dynamic site, so we use browser fetching
        const html = await this.fetchHtmlWithBrowser(url);
        return this.parseSearchResults(html, params);
    }

    // Exposed for testing
    public buildSearchUrl(params: SearchParams): string {
        const resortName = (params as any).resort || '';
        const parkId = this.getResortCode(resortName);
        const date = this.parseDate(params.dateWindow.start); // returns YYYY-MM-DD

        // Calculate end date based on duration
        const startDateObj = new Date(params.dateWindow.start);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(endDateObj.getDate() + params.nights.min);
        const endDate = endDateObj.toISOString().split('T')[0];

        // URL pattern: https://www.awayresorts.co.uk/search/?parkID=7&from=2026-03-09&to=2026-03-13&adults=2&children=2
        const url = new URL('/search/', this.baseUrl);
        url.searchParams.append('parkID', parkId);
        url.searchParams.append('from', date || '');
        url.searchParams.append('to', endDate);
        url.searchParams.append('adults', params.party.adults.toString());
        url.searchParams.append('children', params.party.children.toString());

        // If we want to support pets, we'd add &pets=1 etc.
        // For now assuming 0 pets or sticking to basic params.

        return url.toString();
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/latest-offers/`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // Away Resorts results are grouped by accommodation type
        // We look for .date-scroll__day elements which represent specific stay options

        $('.date-scroll__day').each((_, element) => {
            const el = $(element);

            // Skip sold out dates
            if (el.hasClass('date-scroll__day--sold') || el.text().includes('Sold out')) {
                return;
            }

            // Check for book button to ensure it's a valid bookable slot
            const bookBtn = el.find('a[href*="/book/"]');
            if (bookBtn.length === 0) return;

            // Extract data attributes from the button if available
            // e.g. data-name="Comfort Caravan (Pet Friendly)" data-cost="156"
            const name = bookBtn.attr('data-name') || '';
            const dataCost = bookBtn.attr('data-cost');
            let price = 0;

            if (dataCost) {
                price = parseFloat(dataCost);
            } else {
                // Fallback to scraping text
                const priceText = el.find('.date-scroll__price, .-h3, .-h4-like').first().text().trim();
                price = this.extractPrice(priceText) || 0;
            }

            if (!name || !price || isNaN(price)) return;

            // If data-name is missing, try to find the heading in the parent section
            let finalName = name;
            if (!finalName) {
                const section = el.closest('.search-results__accommodation');
                finalName = section.find('h2').first().text().trim();
            }

            // ResultMatcher expects specific structure, map fields appropriately
            // Construct a partial object for matching
            const paramsAccomType = params.accommodation;

            const { confidence, description } = ResultMatcher.classify({
                accomType: finalName,
                priceTotalGbp: price,
                stayNights: params.nights.min,
                stayStartDate: params.dateWindow.start
            } as any, {
                targetData: {
                    dateStart: params.dateWindow.start,
                    nights: params.nights.min,
                    party: params.party,
                    pets: params.pets,
                    accommodationType: paramsAccomType || AccommodationType.ANY,
                    minBedrooms: params.minBedrooms
                } as any
            });

            results.push({
                // provider: this.providerCode, // Removed as it's not in PriceResult interface
                accomType: finalName,
                priceTotalGbp: price,
                stayNights: params.nights.min,
                availability: 'AVAILABLE',
                stayStartDate: params.dateWindow.start,
                pricePerNightGbp: price / params.nights.min,
                matchConfidence: confidence,
                matchDetails: description,
                sourceUrl: this.baseUrl + bookBtn.attr('href')
            });
        });

        return results;
    }

    async fetchOffers(): Promise<DealResult[]> {
        const url = this.buildOffersUrl();
        const html = await this.fetchHtmlWithBrowser(url);
        return this.parseOffers(html);
    }

    // Exposed for testing
    public parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const deals: DealResult[] = [];

        // Heuristic parsing for offers page - this structure is assumed common for generic offer blocks
        // On /latest-offers/ page, looking for card-like elements
        $('.card, .offer-card, .promo-block').each((_, element) => {
            const el = $(element);
            const title = el.find('h3, .card-title').text().trim();
            const description = el.find('p, .card-text').text().trim();
            if (!title) return;

            if (!title) return;

            // DealResult interface does not have description, putting it in restrictions
            deals.push({
                title,
                restrictions: { description },
                discountType: 'PERK', // Default to PERK for generic offers
                discountValue: 0
            });
        });

        return deals;
    }
}
