import { ParkdeanAdapter } from '../../../src/adapters/parkdean.adapter';
import { SearchParams } from '../../../src/adapters/base.adapter';
import { AccommodationType } from '../../../src/entities/HolidayProfile';

describe('ParkdeanAdapter', () => {
    let adapter: ParkdeanAdapter;

    beforeEach(() => {
        // Mock environment variables if needed
        process.env.PARKDEAN_BASE_URL = 'https://www.parkdeanresorts.co.uk';
        process.env.SCRAPING_ENABLED = 'true';
        process.env.PROVIDER_PARKDEAN_ENABLED = 'true';
        adapter = new ParkdeanAdapter();
    });

    describe('buildSearchUrl', () => {
        it('should construct correct URL for basic search', () => {
            const params: SearchParams = {
                provider: 'parkdean',
                party: {
                    adults: 2,
                    children: 2
                },
                dateWindow: {
                    start: '2025-07-15',
                    end: '2025-07-15'
                },
                nights: {
                    min: 3,
                    max: 3
                },
                pets: false,
                minBedrooms: 2,
                peakTolerance: 'peak'
            };

            // Using reflection to access protected method for testing
            const url = (adapter as any).buildSearchUrl(params);

            // Expecting: https://www.parkdeanresorts.co.uk/search-results/?adults=2&children=2&arriving=15/07/2025&nights=3
            expect(url).toContain('https://www.parkdeanresorts.co.uk/search-results/');
            expect(url).toContain('adults=2');
            expect(url).toContain('children=2');
            expect(url).toContain('nights=3');
            // Check date format DD/MM/YYYY
            expect(url).toContain('arriving=15%2F07%2F2025');
        });

        it('should include region if provided', () => {
            const params: SearchParams = {
                provider: 'parkdean',
                party: { adults: 2, children: 0 },
                dateWindow: { start: '2025-08-01', end: '2025-08-01' },
                nights: { min: 7, max: 7 },
                pets: true,
                minBedrooms: 1,
                peakTolerance: 'peak',
                region: 'Cornwall'
            };

            const url = (adapter as any).buildSearchUrl(params);
            expect(url).toContain('region=Cornwall');
            expect(url).toContain('pets=1');
        });
    });

    describe('parseSearchResults', () => {
        it('should parse valid HTML results correctly', () => {
            const mockHtml = `
                <div class="search-result">
                    <h3 class="property-name">Sandford Holiday Park</h3>
                    <div class="location">Dorset</div>
                    <div class="price">£249.00</div>
                    <a href="/holidays/dorset/sandford/">View Deal</a>
                </div>
                <div class="search-result">
                    <h3 class="property-name">Trecco Bay</h3>
                    <div class="location">Wales</div>
                    <div class="price">£399</div>
                    <a href="/holidays/wales/trecco-bay/">View Deal</a>
                </div>
            `;

            const params: SearchParams = {
                provider: 'parkdean',
                party: { adults: 2, children: 2 },
                dateWindow: { start: '2025-07-15', end: '2025-07-15' },
                nights: { min: 3, max: 3 },
                pets: false,
                minBedrooms: 2,
                peakTolerance: 'peak'
            };

            const results = (adapter as any).parseSearchResults(mockHtml, params);

            expect(results).toHaveLength(2);

            // First result
            expect(results[0].propertyName).toBe('Sandford Holiday Park');
            expect(results[0].priceTotalGbp).toBe(249);
            expect(results[0].location).toBe('Dorset');
            expect(results[0].parkId).toBe('sandford');

            // Second result
            expect(results[1].propertyName).toBe('Trecco Bay');
            expect(results[1].priceTotalGbp).toBe(399);
            expect(results[1].parkId).toBe('trecco-bay');
        });

        it('should handle missing prices gracefully', () => {
            const mockHtml = `
                <div class="search-result">
                    <h3 class="property-name">Sold Out Park</h3>
                    <div class="price">Sold Out</div>
                </div>
            `;

            const params: SearchParams = {
                provider: 'parkdean',
                party: { adults: 2, children: 2 },
                dateWindow: { start: '2025-07-15', end: '2025-07-15' },
                nights: { min: 3, max: 3 },
                pets: false,
                minBedrooms: 2,
                peakTolerance: 'peak'
            };

            const results = (adapter as any).parseSearchResults(mockHtml, params);
            expect(results).toHaveLength(0);
        });
    });
});
