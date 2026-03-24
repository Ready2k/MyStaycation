import { MockProviderAdapter } from './MockProvider';
import { ProviderAdapter, SearchSearchResult } from './types';
import { HolidayProfile } from '../../entities/HolidayProfile';
import { TripCostService } from '../trip-cost.service';
import { UserTripConfig } from '../../types/trip-cost.types';

export class SearchService {
    private adapters: ProviderAdapter[] = [];
    private tripCostService = TripCostService.getInstance();

    constructor() {
        this.adapters.push(new MockProviderAdapter());
    }

    async searchForProfile(profile: HolidayProfile, userConfig?: UserTripConfig): Promise<SearchSearchResult[]> {
        const results: SearchSearchResult[] = [];

        const fingerprint = {
            location: profile.name,
            dateStart: profile.dateStart,
            durationNightsMin: profile.durationNightsMin
        };

        for (const adapter of this.adapters) {
            try {
                const providerResults = await adapter.search(fingerprint);
                
                // Enrich with Trip Cost if user config is available
                if (userConfig?.homeLatLng) {
                    for (const res of providerResults) {
                        try {
                            // In a real app, we would resolve the park's lat/lng from the database
                            // Here we use a mock destination for demonstration
                            const mockDestination = { lat: 53.0, lng: -4.0 }; 
                            
                            res.tripCost = await this.tripCostService.calculateTotalTripCost({
                                originLatLng: userConfig.homeLatLng,
                                destinationLatLng: mockDestination,
                                stayNights: res.durationNights,
                                providerKey: res.provider.toLowerCase(),
                                engineType: userConfig.engineType || 'PETROL',
                                partySize: { adults: 2, children: 0 } // Default
                            });
                        } catch (costErr) {
                            console.error('Failed to calculate trip cost for result:', costErr);
                        }
                    }
                }

                results.push(...providerResults);
            } catch (error) {
                console.error(`Error searching ${adapter.providerName}:`, error);
            }
        }

        return results;
    }
}

export const searchService = new SearchService();
