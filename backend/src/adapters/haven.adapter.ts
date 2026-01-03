import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export class HavenAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.HAVEN_BASE_URL || 'https://www.haven.com',
            'haven'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        if (!this.isEnabled()) {
            console.log('⚠️  Haven adapter is disabled');
            return [];
        }

        const url = this.buildSearchUrl(params);
        console.log('DEBUG: Haven Search URL:', url);

        const path = new URL(url).pathname;
        const allowed = await this.checkRobotsTxt(path);
        if (!allowed) {
            console.warn(`⚠️  Path ${path} is disallowed by robots.txt for Haven`);
            return [];
        }

        try {
            const html = await this.fetchHtml(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.log('HTTP fetch failed, trying Playwright...', error);
            try {
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
            console.error('Failed to fetch Haven offers:', error);
            return [];
        }
    }

    protected buildSearchUrl(params: SearchParams): string {
        // Haven URL structure (example - needs verification)
        const queryParams = new URLSearchParams({
            adults: params.party.adults.toString(),
            children: params.party.children.toString(),
            'check-in': params.dateWindow.start,
            'check-out': params.dateWindow.end,
            nights: params.nights.min.toString(),
        });

        if (params.park) {
            queryParams.append('park', params.park);
        }

        // [NEW] Respect Fingerprint pets
        if (params.pets) {
            queryParams.append('pets', 'true');
        }

        return `${this.baseUrl}/holidays/search?${queryParams.toString()}`;
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/offers`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // NOTE: These selectors are EXAMPLES - update based on actual Haven HTML
        $('.accommodation-result, .holiday-card').each((_, element) => {
            try {
                const $el = $(element);

                // Extract price - REQUIRED
                const priceText = $el.find('.price-total, .holiday-price').first().text().trim();
                const priceTotalGbp = this.extractPrice(priceText);
                if (!priceTotalGbp) {
                    return;
                }

                // Extract dates - REQUIRED, must be explicit
                const dateText = $el.find('.arrival-date, .check-in-date').first().text().trim();
                const stayStartDate = this.parseDate(dateText);
                if (!stayStartDate) {
                    console.warn('Skipping Haven result: could not parse stay date');
                    return;
                }

                // Extract nights - REQUIRED
                const nightsText = $el.find('.nights, .duration').first().text().trim();
                const stayNights = this.parseNights(nightsText);
                if (!stayNights) {
                    console.warn('Skipping Haven result: could not parse nights');
                    return;
                }

                // Calculate per night price safely
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights);
                if (!pricePerNightGbp) {
                    console.warn('Skipping Haven result: could not calculate price per night');
                    return;
                }

                // Check availability
                const isAvailable = !$el.find('.sold-out, .not-available').length;
                const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';

                // Extract accommodation type (optional)
                const accomType = $el.find('.accommodation-type, .grade').first().text().trim() || undefined;

                // [NEW] Extract bedrooms and pets for matching
                // Example extractors:
                const bedroomsText = $el.find('.bedrooms, .sleeps').first().text();
                const bedroomsMatch = bedroomsText.match(/(\d+)\s*bed/i);
                const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : undefined;

                const petsText = $el.find('.pets, .dog-friendly').first().text().toLowerCase();
                const petsAllowed = petsText.includes('dog') || petsText.includes('pet');

                // Extract and normalize source URL
                const rawUrl = $el.find('a').first().attr('href');
                const sourceUrl = this.normalizeUrl(rawUrl);

                // [NEW] CLASSIFY RESULT
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
                        dateStart: params.dateWindow.start, // Fingerprint start date
                        nights: params.nights.min,          // Fingerprint nights (assuming single night search for now)
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
                console.error('Error parsing Haven result:', error);
            }
        });

        console.log(`✅ Parsed ${results.length} valid results from Haven`);
        return results;
    }

    protected parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const deals: DealResult[] = [];

        $('.offer, .special-offer-card').each((_, element) => {
            try {
                const $el = $(element);

                const title = $el.find('.offer-title, h2, h3').first().text().trim();
                if (!title) return;

                const discountText = $el.find('.discount-amount, .save-text').first().text().trim();
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

                const voucherCode = $el.find('.code, .promo-code').first().text().trim() || undefined;

                const validUntilText = $el.find('.valid-until, .offer-ends').first().text().trim();
                const endsAt = validUntilText ? this.parseDate(validUntilText) : null;

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    voucherCode,
                    endsAt: endsAt ? new Date(endsAt) : undefined,
                });
            } catch (error) {
                console.error('Error parsing Haven offer:', error);
            }
        });

        return deals;
    }
}
