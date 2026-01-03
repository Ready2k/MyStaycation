import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export class CenterParcsAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.CENTERPARCS_BASE_URL || 'https://www.centerparcs.co.uk',
            'centerparcs'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        if (!this.isEnabled()) {
            console.log('⚠️  Center Parcs adapter is disabled');
            return [];
        }

        // Center Parcs requires Playwright due to their dynamic booking form
        try {
            const url = this.buildSearchUrl(params);
            console.log('DEBUG: Center Parcs Search URL:', url);

            const html = await this.fetchHtmlWithBrowser(url, async (page) => {
                // Wait for the booking form to load
                await page.waitForSelector('.booking-bar, #booking-form', { timeout: 5000 }).catch(() => { });

                // Fill in the booking form if present
                try {
                    // Select village (if region is specified, try to match it)
                    if (params.region) {
                        await page.selectOption('select[name="village"], #village-select', { label: params.region }).catch(() => {
                            console.warn(`Could not select village: ${params.region}`);
                        });
                    }

                    // Set arrival date
                    const arrivalInput = await page.$('input[name="arrival"], #arrival-date');
                    if (arrivalInput) {
                        await arrivalInput.fill(params.dateWindow.start);
                    }

                    // Set number of nights
                    const nightsSelect = await page.$('select[name="nights"], #nights');
                    if (nightsSelect) {
                        await nightsSelect.selectOption({ value: params.nights.min.toString() });
                    }

                    // Set number of adults
                    const adultsInput = await page.$('input[name="adults"], #adults');
                    if (adultsInput) {
                        await adultsInput.fill(params.party.adults.toString());
                    }

                    // Set number of children
                    if (params.party.children) {
                        const childrenInput = await page.$('input[name="children"], #children');
                        if (childrenInput) {
                            await childrenInput.fill(params.party.children.toString());
                        }
                    }

                    // Submit the form
                    const submitButton = await page.$('button[type="submit"], .search-button, .book-now');
                    if (submitButton) {
                        await submitButton.click();
                        // Wait for results to load
                        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                    }
                } catch (formError) {
                    console.warn('Could not interact with booking form:', formError);
                }
            });

            return this.parseSearchResults(html, params);
        } catch (error) {
            console.error('Center Parcs search failed:', error);
            return [];
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
            console.error('Failed to fetch Center Parcs offers:', error);
            return [];
        }
    }

    protected buildSearchUrl(params: SearchParams): string {
        // Center Parcs uses a booking bar interface, so we'll navigate to the main page
        // and let Playwright fill in the form
        return `${this.baseUrl}/breaks`;
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/offers`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // NOTE: These selectors are EXAMPLES and need to be updated based on actual Center Parcs HTML structure
        $('.accommodation-card, .lodge-card, .result-item').each((_, element) => {
            try {
                const $el = $(element);

                // Extract price - REQUIRED
                const priceText = $el.find('.price, .total-price, .from-price').first().text().trim();
                const priceTotalGbp = this.extractPrice(priceText);
                if (!priceTotalGbp) {
                    return;
                }

                // Extract dates - REQUIRED
                const dateText = $el.find('.date, .arrival-date, .check-in').first().text().trim();
                const stayStartDate = this.parseDate(dateText);
                if (!stayStartDate) {
                    console.warn('Skipping result: could not parse stay date');
                    return;
                }

                // Extract nights - REQUIRED
                const nightsText = $el.find('.nights, .duration, .stay-length').first().text().trim();
                const stayNights = this.parseNights(nightsText);
                if (!stayNights) {
                    console.warn('Skipping result: could not parse nights');
                    return;
                }

                // Calculate per night price
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights);
                if (!pricePerNightGbp) {
                    console.warn('Skipping result: could not calculate price per night');
                    return;
                }

                // Check availability
                const isAvailable = !$el.find('.sold-out, .unavailable, .fully-booked').length;
                const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';

                // Extract accommodation type
                const accomType = $el.find('.lodge-type, .accommodation-type').first().text().trim() || undefined;

                // Extract bedrooms
                const bedroomsText = $el.find('.bedrooms, .sleeps').first().text();
                const bedroomsMatch = bedroomsText.match(/(\d+)\s*bed/i);
                const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : undefined;

                // Extract pets
                const petsText = $el.find('.pet-friendly, .pets').first().text().toLowerCase();
                const petsAllowed = petsText.includes('pet') || petsText.includes('dog');

                // Extract source URL
                const rawUrl = $el.find('a').first().attr('href');
                const sourceUrl = this.normalizeUrl(rawUrl);

                // Classify result
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
                console.error('Error parsing Center Parcs result:', error);
            }
        });

        console.log(`✅ Parsed ${results.length} valid results from Center Parcs`);
        return results;
    }

    protected parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const deals: DealResult[] = [];

        $('.offer-card, .deal-item, .special-offer').each((_, element) => {
            try {
                const $el = $(element);

                const title = $el.find('.offer-title, h2, h3').first().text().trim();
                if (!title) return;

                // Extract discount information
                const discountText = $el.find('.discount, .save, .offer-value').first().text().trim();
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

                // Extract dates
                const validUntilText = $el.find('.valid-until, .expires, .offer-ends').first().text().trim();
                const endsAt = validUntilText ? this.parseDate(validUntilText) : null;

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    voucherCode,
                    endsAt: endsAt ? new Date(endsAt) : undefined,
                });
            } catch (error) {
                console.error('Error parsing Center Parcs offer:', error);
            }
        });

        return deals;
    }
}
