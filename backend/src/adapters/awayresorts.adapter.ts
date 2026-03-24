
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import * as cheerio from 'cheerio';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';
import { SystemLogger } from '../services/SystemLogger';
import { LocationNotFoundError } from '../utils/errors';

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
        if (!resorts[q] && q) {
            const message = `AwayResorts: Location "${query}" not found in static map.`;
            SystemLogger.warn(
                message,
                'AwayResortsAdapter',
                { query }
            ).catch(err => console.error('Failed to log AwayResorts warning:', err));
            throw new LocationNotFoundError(query, 'awayresorts');
        }

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
        // Away Resorts uses numeric parkIDs (e.g. 7, 23).
        // params.parks[0] may be a numeric ID already (e.g. '7') or a name
        // typed by the user (e.g. 'St Ives'). Resolve accordingly.
        const resortName = (params as any).resort || '';
        const firstPark = params.parks && params.parks.length > 0 ? params.parks[0] : '';
        const parkId = firstPark
            ? /^\d+$/.test(firstPark)
                ? firstPark                        // already a numeric ID — use directly
                : this.getResortCode(firstPark)    // name string — look up numeric ID
            : this.getResortCode(resortName);      // no parks at all — fall back to resort param
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

            // Extract parkId from URL
            const bookUrl = bookBtn.attr('href') || '';
            let parkId = this.extractParkId(bookUrl);

            // Fallback to region param if available
            if (!parkId && params.region) {
                // Use getResortCode to ensure we map "tattershall" -> "7" consistent with search
                // Or just use the slug if that's what we want.
                // The current implementation seems to use mapped IDs for Search but maybe slugs for Results?
                // Let's stick to what worked before but better:
                parkId = params.region.toLowerCase().replace(/\s+/g, '-');
                // Or verify if we should use getResortCode(params.region)
            }

            // Ensure we have a propertyName (Park Name) to avoid worker warnings
            // If we are searching a specific region/park, that is the property name.
            let propertyName = params.region || 'Away Resorts Park';
            // If we have a mapped resort name from the ID, we could use that, but we don't have a reverse map.

            results.push({
                // provider: this.providerCode,
                accomType: finalName,
                priceTotalGbp: price,
                stayNights: params.nights.min,
                availability: 'AVAILABLE',
                stayStartDate: params.dateWindow.start,
                pricePerNightGbp: price / params.nights.min,
                parkId, // CRITICAL: Required for seriesKey generation
                matchConfidence: confidence,
                matchDetails: description,
                propertyName, // Added to fix worker warning
                sourceUrl: this.baseUrl + bookUrl
            });
        });

        return results;
    }

    private extractParkId(url: string | undefined): string | undefined {
        if (!url) return undefined;
        // Match /book/PARK-ID/ or /book/PARK-ID?
        // Exclude ? to avoid capturing query strings
        const match = url.match(/\/book\/([^/?]+)/i);
        return match ? match[1] : undefined;
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

        // Away Resorts /latest-offers/ page uses merchandising module cards.
        // Each deal card has the class: div.module-container.js-merchandising-module
        // Structure:
        //   a.merchandising-module-link[href="/search/?parkID=..."]
        //     div.mm-title h3  -> Park name (e.g. "St Ives Bay")
        //     div.location     -> Location (e.g. "Cornwall")
        //     div.date         -> Date range (e.g. "23rd Mar - 26th Mar")
        //     div.description  -> Price text (e.g. "£99 for 3 nights")
        $('.module-container.js-merchandising-module').each((_, element) => {
            const el = $(element);

            // Park name from h3 inside mm-title
            const parkName = el.find('.mm-title h3').text().trim();
            if (!parkName) return;

            const location = el.find('.location').text().trim();
            const dateRange = el.find('.date').text().trim();
            const descriptionText = el.find('.description').text().trim();

            // Build a descriptive title
            const title = location
                ? `${parkName} - ${location}`
                : parkName;

            // Extract price from description text (e.g. "£99 for 3 nights")
            const priceMatch = descriptionText.match(/£(\d[\d,.]*)/);
            const discountValue = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

            // Build restrictions object with additional context
            const restrictions: Record<string, string> = {};
            if (dateRange) restrictions['dates'] = dateRange;
            if (descriptionText) restrictions['description'] = descriptionText;

            deals.push({
                title,
                restrictions,
                discountType: 'SALE_PRICE',
                discountValue
            });
        });

        return deals;
    }
}
