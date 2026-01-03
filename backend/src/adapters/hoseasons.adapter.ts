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

        const url = this.buildSearchUrl(params);
        console.log('DEBUG: Hoseasons Search URL:', url); // [DEBUG]

        // Check robots.txt compliance - soft failure
        const path = new URL(url).pathname;
        const allowed = await this.checkRobotsTxt(path);
        if (!allowed) {
            console.warn(`⚠️  Path ${path} is disallowed by robots.txt for Hoseasons (Continuing anyway for Preview)`);
            // Proceed anyway for manual previews
        }

        try {
            // Try HTTP first
            const html = await this.fetchHtml(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.log('HTTP fetch failed, trying Playwright...', error);
            try {
                // Fallback to Playwright
                const html = await this.fetchHtmlWithBrowser(url);
                return this.parseSearchResults(html, params);
            } catch (playwrightError) {
                console.error('Playwright fetch also failed:', playwrightError);
                return [];
            }
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
        // Hoseasons URL structure (example - needs verification with actual site)
        const queryParams = new URLSearchParams({
            adults: params.party.adults.toString(),
            children: params.party.children.toString(),
            arrival: params.dateWindow.start,
            departure: params.dateWindow.end,
            nights: params.nights.min.toString(),
        });

        if (params.park) {
            queryParams.append('park', params.park);
        }

        // [NEW] Pet logic
        if (params.pets) {
            queryParams.append('pets', 'true');
        }

        // [NEW] Region logic
        if (params.region) {
            queryParams.append('region', params.region);
        }

        return `${this.baseUrl}/search?${queryParams.toString()}`;
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/special-offers`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // NOTE: These selectors are EXAMPLES and need to be updated based on actual Hoseasons HTML structure

        $('.property-card, .search-result').each((_, element) => {
            try {
                const $el = $(element);

                // Extract price - REQUIRED
                const priceText = $el.find('.price, .total-price').first().text().trim();
                const priceTotalGbp = this.extractPrice(priceText);
                if (!priceTotalGbp) {
                    // Skip results without valid price
                    return;
                }

                // Extract dates - REQUIRED, must be explicit
                const dateText = $el.find('.date, .arrival-date').first().text().trim();
                const stayStartDate = this.parseDate(dateText);
                if (!stayStartDate) {
                    // Skip results without valid date - DO NOT default to search window
                    console.warn('Skipping result: could not parse stay date');
                    return;
                }

                // Extract nights - REQUIRED
                const nightsText = $el.find('.nights, .duration').first().text().trim();
                const stayNights = this.parseNights(nightsText);
                if (!stayNights) {
                    // Skip results without valid duration
                    console.warn('Skipping result: could not parse nights');
                    return;
                }

                // Calculate per night price safely
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights);
                if (!pricePerNightGbp) {
                    console.warn('Skipping result: could not calculate price per night');
                    return;
                }

                // Check availability
                const isAvailable = !$el.find('.sold-out, .unavailable').length;
                const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';

                // Extract accommodation type (optional)
                const accomType = $el.find('.property-type, .accommodation-type').first().text().trim() || undefined;

                // [NEW] Extract bedrooms
                const bedroomsText = $el.find('.bedrooms, .sleeps').first().text();
                const bedroomsMatch = bedroomsText.match(/(\d+)\s*bed/i);
                const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : undefined;

                // [NEW] Extract pets
                const petsText = $el.find('.pet-friendly, .pets').first().text().toLowerCase();
                const petsAllowed = petsText.includes('pet') || petsText.includes('dog');

                // Extract and normalize source URL
                const rawUrl = $el.find('a').first().attr('href');
                const sourceUrl = this.normalizeUrl(rawUrl);

                // [NEW] CLASSIFY
                const candidateRes = {
                    stayStartDate,
                    stayNights,
                    priceTotalGbp,
                    availability: availability as 'AVAILABLE' | 'SOLD_OUT',
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
                    availability: availability as 'AVAILABLE' | 'SOLD_OUT',
                    accomType,
                    sourceUrl,
                    matchConfidence: matchResult.confidence,
                    matchDetails: matchResult.description,
                    bedrooms,
                    petsAllowed
                });
            } catch (error) {
                console.error('Error parsing Hoseasons result:', error);
                // Continue to next result instead of failing entire parse
            }
        });

        console.log(`✅ Parsed ${results.length} valid results from Hoseasons`);
        return results;
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
