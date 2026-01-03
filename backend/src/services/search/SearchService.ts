import { MockProviderAdapter } from './MockProvider';
import { ProviderAdapter, SearchSearchResult } from './types';
import { HolidayProfile } from '../../entities/HolidayProfile';

export class SearchService {
    private adapters: ProviderAdapter[] = [];

    constructor() {
        // In reality, we'd register real adapters here
        this.adapters.push(new MockProviderAdapter());
    }

    async searchForProfile(profile: HolidayProfile): Promise<SearchSearchResult[]> {
        const results: SearchSearchResult[] = [];

        // Fingerprint generation logic would go here (converting profile to search params)
        const fingerprint = {
            location: profile.name, // Simplified for mock
            dateStart: profile.dateStart,
            durationNightsMin: profile.durationNightsMin
        };

        for (const adapter of this.adapters) {
            try {
                console.log(`Searching ${adapter.providerName} for profile ${profile.id}...`);
                const providerResults = await adapter.search(fingerprint);
                results.push(...providerResults);
            } catch (error) {
                console.error(`Error searching ${adapter.providerName}:`, error);
            }
        }

        return results;
    }
}

export const searchService = new SearchService();
