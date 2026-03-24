export interface SearchSearchResult {
    provider: string;
    location: string;
    dateStart: Date;
    durationNights: number;
    priceGbp: number;
    uRL: string;
    accommodationName: string;
    available: boolean;
    tripCost?: {
        distanceMiles: number;
        drivingMinutes: number;
        fuelCostGbp: number;
        ferryCostGbp: number;
        onParkEstLow: number;
        onParkEstHigh: number;
        totalLow: number;
        totalHigh: number;
        isEstimate: boolean;
    };
}

export interface ProviderAdapter {
    providerName: string;
    search(fingerprint: Record<string, unknown>): Promise<SearchSearchResult[]>;
}
