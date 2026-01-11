import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';
import * as cheerio from 'cheerio';
import { ResultMatcher } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export class ButlinsAdapter extends BaseAdapter {
    constructor() {
        super('https://www.butlins.com', 'butlins');
    }

    async search(params: SearchParams): Promise<PriceResult[]> {
        if (!this.isEnabled()) return [];

        const url = this.buildSearchUrl(params);
        try {
            const html = await this.fetchHtmlWithBrowser(url);
            return this.parseSearchResults(html, params);
        } catch (error) {
            console.error('Error fetching Butlins search results:', error);
            return [];
        }
    }

    protected getResortCode(query: string): string {
        const q = (query || '').toLowerCase();
        if (q.includes('bognor') || q.includes('regis')) return 'BG';
        if (q.includes('minehead')) return 'MH';
        if (q.includes('skegness')) return 'SK';
        return 'BG';
    }

    protected buildSearchUrl(params: SearchParams): string {
        const resort = this.getResortCode(params.region || '');
        const date = params.dateWindow.start; // BaseAdapter uses dateWindow.start (YYYY-MM-DD string often)

        // Butlin's expects ISO date YYYY-MM-DD
        const url = new URL('/booking/search', this.baseUrl);
        url.searchParams.append('resort', resort);
        url.searchParams.append('startDate', date);
        url.searchParams.append('duration', params.nights.min.toString());
        url.searchParams.append('adults', (params.party.adults !== undefined ? params.party.adults : 2).toString());
        url.searchParams.append('children', (params.party.children !== undefined ? params.party.children : 2).toString());

        return url.toString();
    }

    protected buildOffersUrl(): string {
        return `${this.baseUrl}/offers`;
    }

    protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
        const $ = cheerio.load(html);
        const results: PriceResult[] = [];

        const noResultsText = $('body').text().toLowerCase();
        if (noResultsText.includes('no availability') ||
            noResultsText.includes('no breaks found') ||
            noResultsText.includes('sorry, no')) {
            return [];
        }

        const accommodationHeaders = $('h2, h3').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('room') || text.includes('apartment') || text.includes('gold') || text.includes('silver') || text.includes('standard');
        });

        accommodationHeaders.each((i, el) => {
            const title = $(el).text().trim();
            const container = $(el).closest('div');

            let priceText = container.text();
            if (!priceText.includes('£') && container.parent().length) {
                priceText = container.parent().text();
            }

            const priceMatch = priceText.match(/£([\d,]+)/);

            if (title && priceMatch) {
                const priceTotalGbp = parseFloat(priceMatch[1].replace(/,/g, ''));
                const stayNights = params.nights.min;
                const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights) || 0;

                const candidateRes = {
                    stayStartDate: params.dateWindow.start,
                    stayNights,
                    priceTotalGbp,
                    availability: 'AVAILABLE' as const,
                    accomType: title,
                    bedrooms: Math.ceil(params.party.adults / 2),
                    petsAllowed: params.pets
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
                    stayStartDate: params.dateWindow.start,
                    stayNights,
                    priceTotalGbp,
                    pricePerNightGbp,
                    availability: 'AVAILABLE',
                    accomType: title,
                    sourceUrl: this.buildSearchUrl(params), // Approximate deep link
                    matchConfidence: matchResult.confidence,
                    matchDetails: matchResult.description,
                    bedrooms: candidateRes.bedrooms,
                    petsAllowed: candidateRes.petsAllowed,
                    propertyName: title,
                    location: params.region || 'Butlins',
                    parkId: this.getResortCode(params.region || '')
                });
            }
        });

        // Fallback parsing (simplified for brevity but robust enough for v1)
        if (results.length === 0) {
            $('[class*="Price"], [class*="price"]').each((i, el) => {
                const text = $(el).text().trim();
                if (text.includes('£')) {
                    const match = text.match(/£([\d,]+)/);
                    if (match) {
                        const nearbyTitle = $(el).closest('div').parent().find('h2, h3').first().text().trim() || 'Butlins Break';
                        const priceTotalGbp = parseFloat(match[1].replace(/,/g, ''));

                        // Avoid duplicates
                        if (!results.some(r => r.priceTotalGbp === priceTotalGbp && r.accomType === nearbyTitle)) {
                            const stayNights = params.nights.min;
                            const pricePerNightGbp = this.calculatePricePerNight(priceTotalGbp, stayNights) || 0;

                            // Create dummy match confidence for fallback
                            const matchResult = ResultMatcher.classify({
                                stayStartDate: params.dateWindow.start,
                                stayNights,
                                priceTotalGbp,
                                availability: 'AVAILABLE',
                                accomType: nearbyTitle,
                                bedrooms: Math.ceil(params.party.adults / 2),
                                petsAllowed: params.pets
                            }, {
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
                                stayStartDate: params.dateWindow.start,
                                stayNights,
                                priceTotalGbp,
                                pricePerNightGbp,
                                availability: 'AVAILABLE',
                                accomType: nearbyTitle, // Mapped to accomType
                                sourceUrl: this.buildSearchUrl(params),
                                matchConfidence: matchResult.confidence, // Fallback confidence
                                matchDetails: 'Fallback parser match',
                                bedrooms: undefined,
                                petsAllowed: undefined,
                                propertyName: nearbyTitle,
                                location: params.region || 'Butlins',
                                parkId: this.getResortCode(params.region || '')
                            });
                        }
                    }
                }
            });
        }

        return results;
    }

    async fetchOffers(): Promise<DealResult[]> {
        if (!this.isEnabled()) return [];
        const url = this.buildOffersUrl();
        try {
            const html = await this.fetchHtmlWithBrowser(url);
            return this.parseOffers(html);
        } catch (error) {
            console.error('Error fetching Butlins offers:', error);
            return [];
        }
    }

    protected parseOffers(html: string): DealResult[] {
        const $ = cheerio.load(html);
        const offers: DealResult[] = [];

        $('section, div[class*="Promo"], div[class*="Card"]').each((i, el) => {
            const title = $(el).find('h2, h3').first().text().trim();
            // const description = $(el).find('p').first().text().trim(); // DealResult doesn't have description, only title

            let discountType: DealResult['discountType'] = 'SALE_PRICE';
            let discountValue: number | undefined;

            const percentMatch = title.match(/(\d+)%\s*off/i);
            const priceMatch = title.match(/pounds?\s*(\d+)/i) || title.match(/£(\d+)/);

            if (percentMatch) {
                discountType = 'PERCENT_OFF';
                discountValue = parseInt(percentMatch[1], 10);
            } else if (priceMatch) {
                discountType = 'FIXED_OFF';
                discountValue = parseInt(priceMatch[1], 10);
            }

            if (title && (discountValue || discountType === 'SALE_PRICE')) {
                offers.push({
                    title: title,
                    discountType,
                    discountValue,
                    // No expiration easily parsed
                });
            }
        });

        return offers;
    }
}
