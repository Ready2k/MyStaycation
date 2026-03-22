
import { AwayResortsAdapter } from '../../../src/adapters/awayresorts.adapter';
import { SearchParams } from '../../../src/adapters/base.adapter';

describe('AwayResortsAdapter', () => {
    let adapter: AwayResortsAdapter;
    const mockParams: any = {
        resort: 'Tattershall Lakes',
        dateWindow: { start: '2026-03-09', end: '2026-03-13' },
        nights: { min: 4, max: 4 },
        party: { adults: 2, children: 2 },
        accommodation: 'caravan',
        provider: 'awayresorts',
        peakTolerance: 'offpeak',
        pets: false,
        minBedrooms: 0,
        region: 'Tattershall Lakes'
    };

    beforeEach(() => {
        adapter = new AwayResortsAdapter();
    });

    describe('buildSearchUrl', () => {
        it('should construct correct URL for Tattershall Lakes', () => {
            const url = adapter.buildSearchUrl(mockParams);
            expect(url).toContain('parkID=7');
            expect(url).toContain('from=2026-03-09');
            // End date should be start + 4 days = 2026-03-13
            expect(url).toContain('to=2026-03-13');
            expect(url).toContain('adults=2');
            expect(url).toContain('children=2');
        });

        it('should handle resort mapping correctly', () => {
            const params = { ...mockParams, resort: 'Sandy Balls' };
            const url = adapter.buildSearchUrl(params);
            expect(url).toContain('parkID=1');
        });

        it('should default to Tattershall (7) for unknown resort', () => {
            const params = { ...mockParams, resort: 'Unknown Park' };
            const url = adapter.buildSearchUrl(params);
            expect(url).toContain('parkID=7');
        });
    });

    describe('parseSearchResults', () => {
        it('should parse valid result cards', async () => {
            const mockHtml = `
            <div class="search-results__accommodation">
                <h2>Super Accom</h2>
                <div class="date-scroll__day -bg-away-white-updated">
                    <div class="date-scroll__price">
                        <span class="-h4-like">£156</span>
                    </div>
                    <a href="/book/?accommodation=780" 
                    class="js-tracking button button--primary-updated -small ga4_add_booking" 
                    data-name="Comfort Caravan (Pet Friendly)" 
                    data-cost="156.00">
                        <span>Book 4 nights</span>
                    </a>
                </div>
            </div>
            `;

            // @ts-ignore - accessing protected method
            const results = adapter.parseSearchResults(mockHtml, mockParams);

            expect(results).toHaveLength(1);
            expect(results[0].priceTotalGbp).toBe(156);
            expect(results[0].accomType).toBe('Comfort Caravan (Pet Friendly)');
            // provider is not in PriceResult interface, so we don't check it
            expect(results[0].matchConfidence).toBe('STRONG');
        });

        it('should ignore sold out items', async () => {
            const mockHtml = `
            <div class="date-scroll__day date-scroll__day--sold">
                <span class="-strong">Sold out</span>
                <span class="-small">I'm really popular and have sold out already!</span>
            </div>
            `;
            // @ts-ignore
            const results = adapter.parseSearchResults(mockHtml, mockParams);
            expect(results).toHaveLength(0);
        });

        it('should handle fallback price parsing when data attribute missing', async () => {
            const mockHtml = `
            <div class="search-results__accommodation">
                 <h2>Fallback Accom</h2>
                <div class="date-scroll__day">
                    <div class="date-scroll__price">
                        <span class="-h4-like">£299</span>
                    </div>
                    <a href="/book/fallback" class="button button--primary-updated" data-name="Fallback Room">
                        Book
                    </a>
                </div>
            </div>
            `;
            // @ts-ignore
            const results = adapter.parseSearchResults(mockHtml, mockParams);
            expect(results).toHaveLength(1);
            expect(results[0].priceTotalGbp).toBe(299);
            expect(results[0].propertyName).toBe('Tattershall Lakes');
        });

        it('should handle query string URLs by falling back to region', () => {
            const mockHtml = `
            <div class="search-results__accommodation">
                <h2>Query Link Accom</h2>
                <div class="date-scroll__day">
                    <a href="/book/?accommodation=123&foo=bar" data-name="Query Room">Book</a>
                    <div class="date-scroll__price">£100</div>
                </div>
            </div>`;

            // @ts-ignore
            const results = adapter.parseSearchResults(mockHtml, mockParams);
            expect(results).toHaveLength(1);
            // Must NOT be ?accommodation=123
            expect(results[0].parkId).toBe('tattershall-lakes');
            expect(results[0].propertyName).toBe('Tattershall Lakes');
        });
    });

    describe('parseOffers', () => {
        it('should parse merchandising module deal cards', () => {
            const mockHtml = `
            <div class="module-container js-merchandising-module">
                <a href="/search/?parkID=23&from=2026-03-27&to=2026-03-30&nights=3" class="merchandising-module-link">
                    <div class="text-cta-container">
                        <div class="img-text">
                            <div class="mm-title"><h3>St Ives Bay</h3></div>
                            <div class="location">Cornwall</div>
                            <div class="date py-1">27th Mar - 30th Mar</div>
                            <div class="description">£99 for 3 nights</div>
                        </div>
                        <div class="search-button"><span>Check Availability</span></div>
                    </div>
                </a>
            </div>
            <div class="module-container js-merchandising-module">
                <a href="/search/?parkID=15&from=2026-04-10&to=2026-04-17&nights=7" class="merchandising-module-link">
                    <div class="text-cta-container">
                        <div class="img-text">
                            <div class="mm-title"><h3>Whitecliff Bay</h3></div>
                            <div class="location">Isle of Wight</div>
                            <div class="date py-1">10th Apr - 17th Apr</div>
                            <div class="description">£399 for 7 nights</div>
                        </div>
                    </div>
                </a>
            </div>`;

            // @ts-ignore - accessing public method
            const deals = adapter.parseOffers(mockHtml);

            expect(deals).toHaveLength(2);

            // First deal
            expect(deals[0].title).toBe('St Ives Bay - Cornwall');
            expect(deals[0].discountValue).toBe(99);
            expect(deals[0].discountType).toBe('SALE_PRICE');
            expect(deals[0].restrictions).toMatchObject({
                dates: '27th Mar - 30th Mar',
                description: '£99 for 3 nights'
            });

            // Second deal
            expect(deals[1].title).toBe('Whitecliff Bay - Isle of Wight');
            expect(deals[1].discountValue).toBe(399);
        });

        it('should skip cards without a park name', () => {
            const mockHtml = `
            <div class="module-container js-merchandising-module">
                <a href="/search/?parkID=7">
                    <div class="mm-title"><h3></h3></div>
                    <div class="description">£99 for 3 nights</div>
                </a>
            </div>`;

            // @ts-ignore
            const deals = adapter.parseOffers(mockHtml);
            expect(deals).toHaveLength(0);
        });

        it('should return 0 deals for old (wrong) selector structure', () => {
            // The old selectors .card/.offer-card/.promo-block should find nothing
            const mockHtml = `
            <div class="card">
                <h3>Some Deal</h3>
                <p>Old structure</p>
            </div>`;

            // @ts-ignore
            const deals = adapter.parseOffers(mockHtml);
            expect(deals).toHaveLength(0);
        });

        it('should use park name only when no location available', () => {
            const mockHtml = `
            <div class="module-container js-merchandising-module">
                <a href="/search/?parkID=7">
                    <div class="mm-title"><h3>Tattershall Lakes</h3></div>
                    <div class="description">£249 for 4 nights</div>
                </a>
            </div>`;

            // @ts-ignore
            const deals = adapter.parseOffers(mockHtml);
            expect(deals).toHaveLength(1);
            expect(deals[0].title).toBe('Tattershall Lakes');
            expect(deals[0].discountValue).toBe(249);
        });
    });
});
