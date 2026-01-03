import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';

export class HoseasonsAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.HOSEASONS_BASE_URL || 'https://www.hoseasons.co.uk',
            'hoseasons'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const url = this.buildSearchUrl(params);

        // Check robots.txt compliance
        const path = new URL(url).pathname;
        const allowed = await this.checkRobotsTxt(path);
        if (!allowed) {
            throw new Error(`Path ${path} is disallowed by robots.txt`);
        }

        try {
            // Try HTTP first
            const html = await this.fetchHtml(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.log('HTTP fetch failed, trying Playwright...', error);
            // Fallback to Playwright
            const html = await this.fetchHtmlWithBrowser(url);
            return this.parseSearchResults(html, params);
        }
    }

    async fetchOffers(): Promise<DealResult[]> {
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

        return `${this.baseUrl}/search?${queryParams.toString()}`;
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/special-offers`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        // NOTE: These selectors are EXAMPLES and need to be updated based on actual Hoseasons HTML structure
        // You'll need to inspect the actual website to get the correct selectors

        $('.property-card, .search-result').each((_, element) => {
            try {
                const $el = $(element);

                // Extract price
                const priceText = $el.find('.price, .total-price').first().text().trim();
                if (!priceText) return;

                const priceTotalGbp = this.extractPrice(priceText);

                // Extract dates
                const dateText = $el.find('.date, .arrival-date').first().text().trim();
                const stayStartDate = this.parseDate(dateText || params.dateWindow.start);

                // Extract nights
                const nightsText = $el.find('.nights, .duration').first().text().trim();
                const stayNights = parseInt(nightsText) || params.nights.min;

                // Calculate per night price
                const pricePerNightGbp = priceTotalGbp / stayNights;

                // Check availability
                const isAvailable = !$el.find('.sold-out, .unavailable').length;
                const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';

                // Extract accommodation type
                const accomType = $el.find('.property-type, .accommodation-type').first().text().trim();

                // Extract source URL
                const sourceUrl = $el.find('a').first().attr('href');

                results.push({
                    stayStartDate,
                    stayNights,
                    priceTotalGbp,
                    pricePerNightGbp,
                    availability: availability as any,
                    accomType: accomType || undefined,
                    sourceUrl: sourceUrl ? `${this.baseUrl}${sourceUrl}` : undefined,
                });
            } catch (error) {
                console.error('Error parsing Hoseasons result:', error);
            }
        });

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
                    discountValue = parseFloat(discountText.replace(/[^0-9.]/g, ''));
                } else if (discountText.includes('£')) {
                    discountType = 'FIXED_OFF';
                    discountValue = this.extractPrice(discountText);
                }

                // Extract voucher code
                const voucherCode = $el.find('.voucher-code, .promo-code').first().text().trim() || undefined;

                // Extract dates
                const validUntil = $el.find('.valid-until, .expires').first().text().trim();
                const endsAt = validUntil ? new Date(validUntil) : undefined;

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    voucherCode,
                    endsAt,
                });
            } catch (error) {
                console.error('Error parsing Hoseasons offer:', error);
            }
        });

        return deals;
    }
}
