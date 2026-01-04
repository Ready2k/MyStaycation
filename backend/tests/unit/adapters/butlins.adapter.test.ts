
import { ButlinsAdapter } from '../../../src/adapters/butlins.adapter';
import { SearchParams } from '../../../src/adapters/base.adapter';

describe('ButlinsAdapter', () => {
    let adapter: ButlinsAdapter;

    beforeEach(() => {
        adapter = new ButlinsAdapter();
    });

    describe('buildSearchUrl', () => {
        it('should build a correct URL for Bognor Regis', () => {
            const params: SearchParams = {
                region: 'Bognor Regis',
                dateWindow: { start: '2026-02-09', end: '2026-02-13' },
                nights: { min: 4, max: 4 },
                party: { adults: 2, children: 2 },
                pets: false,
                minBedrooms: 2,
                peakTolerance: 'peak'
            } as any;

            const url = adapter['buildSearchUrl'](params);
            expect(url).toContain('resort=BG');
            expect(url).toContain('startDate=2026-02-09');
            expect(url).toContain('duration=4');
            expect(url).toContain('adults=2');
            expect(url).toContain('children=2');
        });

        it('should build a correct URL for Minehead', () => {
            const params: SearchParams = {
                region: 'Minehead',
                dateWindow: { start: '2026-05-15', end: '2026-05-18' },
                nights: { min: 3, max: 3 },
                party: { adults: 2, children: 0 },
                pets: false,
                minBedrooms: 2,
                peakTolerance: 'peak'
            } as any;

            const url = adapter['buildSearchUrl'](params);
            expect(url).toContain('resort=MH');
            expect(url).toContain('startDate=2026-05-15');
            expect(url).toContain('duration=3');
            expect(url).toContain('adults=2');
            expect(url).toContain('children=0');
        });

        it('should default to Bognor Regis (BG) for unknown location', () => {
            const params: SearchParams = {
                region: 'Unknown',
                dateWindow: { start: '2026-06-01', end: '2026-06-08' },
                nights: { min: 7, max: 7 },
                party: { adults: 1, children: 0 },
                pets: false,
                minBedrooms: 1,
                peakTolerance: 'peak'
            } as any;

            const url = adapter['buildSearchUrl'](params);
            expect(url).toContain('resort=BG');
        });
    });

    describe('parseHtml', () => {
        it('should return empty list if "no availability" message is present', () => {
            const html = `
        <html>
          <body>
            <div class="no-results">Sorry, no breaks found for your selection</div>
          </body>
        </html>
      `;
            // @ts-ignore - Accessing protected method for testing
            const results = adapter.parseSearchResults(html, {} as SearchParams);
            expect(results).toEqual([]);
        });

        it('should parse results with structured headings and prices', () => {
            const html = `
        <html>
          <body>
            <div class="AccommodationTypeSelector">
                <div>
                   <h2 class="sc-1lllop4-1">Gold Apartment</h2>
                </div>
                <div>
                   <div class="PriceTitle">from £145</div>
                </div>
            </div>
             <div class="AccommodationTypeSelector">
                <div>
                   <h3 class="sc-1lllop4-1">Silver Room</h3>
                </div>
                <div>
                   <div class="PriceTitle">from £99</div>
                </div>
            </div>
          </body>
        </html>
      `;

            const params = {
                dateWindow: { start: '2026-02-09', end: '2026-02-13' },
                nights: { min: 4, max: 4 },
                party: { adults: 2, children: 2 },
                pets: false
            } as SearchParams;

            // @ts-ignore
            const results = adapter.parseSearchResults(html, params);

            expect(results).toHaveLength(2);
            expect(results[0].accomType).toBe('Gold Apartment');
            expect(results[0].priceTotalGbp).toBe(145);
            expect(results[1].accomType).toBe('Silver Room');
            expect(results[1].priceTotalGbp).toBe(99);
        });

        it('should fallback to flexible parsing if structure is slightly different', () => {
            const html = `
        <html>
          <body>
            <div class="container">
               <h2>Standard Room</h2>
               <div class="price-value">£85</div>
            </div>
          </body>
        </html>
      `;
            const params = {
                dateWindow: { start: '2026-02-09', end: '2026-02-13' },
                nights: { min: 4, max: 4 },
                party: { adults: 2, children: 2 },
                pets: false
            } as SearchParams;

            // @ts-ignore
            const results = adapter.parseSearchResults(html, params);
            expect(results).toHaveLength(1);
            expect(results[0].accomType).toBe('Standard Room');
            expect(results[0].priceTotalGbp).toBe(85);
        });

        it('should handle commas in prices', () => {
            const html = `
        <html>
          <body>
             <div class="AccommodationTypeSelector">
                <h2>Premium Apartment</h2>
                <div class="PriceTitle">from £1,250</div>
            </div>
          </body>
        </html>
      `;
            const params = {
                dateWindow: { start: '2026-02-09', end: '2026-02-13' },
                nights: { min: 4, max: 4 },
                party: { adults: 2, children: 2 },
                pets: false
            } as SearchParams;

            // @ts-ignore
            const results = adapter.parseSearchResults(html, params);
            expect(results).toHaveLength(1);
            expect(results[0].priceTotalGbp).toBe(1250);
        });
    });
});
