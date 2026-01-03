import { ProviderAdapter, SearchSearchResult } from './types';

export class MockProviderAdapter implements ProviderAdapter {
    providerName = 'MockStay';

    async search(fingerprint: any): Promise<SearchSearchResult[]> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const results: SearchSearchResult[] = [];
        const numResults = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < numResults; i++) {
            results.push({
                provider: this.providerName,
                location: fingerprint.location || 'Cornwall Coast',
                dateStart: fingerprint.dateStart ? new Date(fingerprint.dateStart) : new Date(),
                durationNights: fingerprint.durationNightsMin || 3,
                priceGbp: Math.floor(Math.random() * 500) + 300,
                uRL: 'https://example.com/mock-deal',
                accommodationName: `Luxury Caravan ${i + 1}`,
                available: true
            });
        }

        return results;
    }
}
