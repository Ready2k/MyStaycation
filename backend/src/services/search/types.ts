export interface SearchSearchResult {
    provider: string;
    location: string;
    dateStart: Date;
    durationNights: number;
    priceGbp: number;
    uRL: string;
    accommodationName: string;
    available: boolean;
}

export interface ProviderAdapter {
    providerName: string;
    search(fingerprint: any): Promise<SearchSearchResult[]>;
}
