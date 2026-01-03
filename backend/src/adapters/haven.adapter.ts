import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';

export class HavenAdapter extends BaseAdapter {
    constructor() {
        super(
            process.env.HAVEN_BASE_URL || 'https://www.haven.com',
            'haven'
        );
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        const url = this.buildSearchUrl(params);

        const path = new URL(url).pathname;
        const allowed = await this.checkRobotsTxt(path);
        if (!allowed) {
            throw new Error(`Path ${path} is disallowed by robots.txt`);
        }

        try {
            const html = await this.fetchHtml(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.log('HTTP fetch failed, trying Playwright...', error);
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

                const priceText = $el.find('.price-total, .holiday-price').first().text().trim();
                if (!priceText) return;

                const priceTotalGbp = this.extractPrice(priceText);

                const dateText = $el.find('.arrival-date, .check-in-date').first().text().trim();
                const stayStartDate = this.parseDate(dateText || params.dateWindow.start);

                const nightsText = $el.find('.nights, .duration').first().text().trim();
                const stayNights = parseInt(nightsText) || params.nights.min;

                const pricePerNightGbp = priceTotalGbp / stayNights;

                const isAvailable = !$el.find('.sold-out, .not-available').length;
                const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';

                const accomType = $el.find('.accommodation-type, .grade').first().text().trim();

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
                console.error('Error parsing Haven result:', error);
            }
        });

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
                    discountValue = parseFloat(discountText.replace(/[^0-9.]/g, ''));
                } else if (discountText.includes('£')) {
                    discountType = 'FIXED_OFF';
                    discountValue = this.extractPrice(discountText);
                }

                const voucherCode = $el.find('.code, .promo-code').first().text().trim() || undefined;

                const validUntil = $el.find('.valid-until, .offer-ends').first().text().trim();
                const endsAt = validUntil ? new Date(validUntil) : undefined;

                deals.push({
                    title,
                    discountType,
                    discountValue,
                    voucherCode,
                    endsAt,
                });
            } catch (error) {
                console.error('Error parsing Haven offer:', error);
            }
        });

        return deals;
    }
}
