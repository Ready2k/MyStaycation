/**
 * Common TypeScript type definitions for MyStaycation
 * Use these to replace 'any' types throughout the codebase
 */

// ============================================================================
// Authentication & JWT
// ============================================================================

export interface JWTPayload {
    userId: string;
    email: string;
    role?: 'USER' | 'ADMIN';
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest {
    user: JWTPayload;
}

// ============================================================================
// Search & Preview
// ============================================================================

export interface SearchResult {
    providerKey: string;
    location: string;
    propertyName: string;
    price: number;
    stayNights: number;
    stayStartDate: string;
    sourceUrl: string;
    confidence: number;
    reasons?: string[];
    matchDetails?: Record<string, unknown>;
}

export interface PreviewOptions {
    maxResults?: number;
    enrichTopN?: number;
    allowWeakMatches?: boolean;
    includeMismatches?: boolean;
    includeDebug?: boolean;
    forcePlaywright?: boolean;
    includeRaw?: boolean;
}

export interface PreviewResponse {
    providers: ProviderResult[];
    summary: {
        totalMatched: number;
        totalOther: number;
        providersSearched: number;
    };
    debug?: Record<string, unknown>;
}

export interface ProviderResult {
    providerKey: string;
    providerName: string;
    status: 'success' | 'error' | 'disabled';
    results?: {
        matched: SearchResult[];
        other: SearchResult[];
    };
    error?: string;
    debug?: Record<string, unknown>;
}

// ============================================================================
// Profile & Fingerprint
// ============================================================================

export interface ProfileParams {
    dateStart: Date;
    dateEnd: Date;
    durationNightsMin: number;
    durationNightsMax: number;
    partySizeAdults: number;
    partySizeChildren?: number;
    pets: boolean;
    accommodationType: string;
    minBedrooms: number;
    budgetCeilingGbp?: number;
}

export interface FingerprintParams {
    fingerprintId: string;
    providerId: string;
    searchParams: Record<string, unknown>;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface PaginationQuery {
    page?: number;
    limit?: number;
    offset?: number;
}

export interface DateRangeQuery {
    startDate?: string;
    endDate?: string;
}

export interface SearchQuery extends PaginationQuery {
    profileId?: string;
    providerId?: string;
    status?: string;
}

// ============================================================================
// API Responses
// ============================================================================

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    message?: string;
}

export interface ApiErrorResponse {
    success: false;
    error: string;
    message: string;
    details?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Insight & Alert
// ============================================================================

export interface InsightDetails {
    type: string;
    summary: string;
    details: Record<string, unknown>;
    significance: number;
}

export interface AlertEmailData {
    profileName: string;
    insightSummary: string;
    details: Record<string, unknown>;
}

// ============================================================================
// Admin Dashboard
// ============================================================================

export interface SystemStats {
    totalUsers: number;
    totalProfiles: number;
    totalFingerprints: number;
    totalObservations: number;
    activeJobs: number;
}

export interface LogQuery {
    level?: 'INFO' | 'WARN' | 'ERROR';
    source?: string;
    limit?: number;
    offset?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
    {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
    }[Keys];

// ============================================================================
// Database Query Results
// ============================================================================

export interface SeriesKeyResult {
    seriesKey: string;
}

export interface CountResult {
    count: number;
}

// ============================================================================
// Job Queue
// ============================================================================

export interface MonitorJobData {
    fingerprintId: string;
    providerId: string;
    searchParams: Record<string, unknown>;
}

export interface InsightJobData {
    fingerprintId: string;
}

export interface AlertJobData {
    insightId: string;
    userId: string;
}

export interface DealJobData {
    providerId?: string;
}

// ============================================================================
// Provider Adapter
// ============================================================================

export interface ProviderMetadata {
    code: string;
    name: string;
    enabled: boolean;
    supportsPlaywright: boolean;
    baseUrl: string;
}

export interface AdapterSearchParams {
    location?: string;
    dateWindow: {
        start: string;
        end: string;
    };
    durationNights?: number;
    partySize?: {
        adults: number;
        children: number;
        infants: number;
    };
    pets?: boolean;
    accommodationType?: string;
    minBedrooms?: number;
    peakTolerance?: 'offpeak' | 'mixed' | 'peak';
}

export interface CandidateResult {
    providerKey: string;
    parkId?: string;
    location?: string;
    propertyName?: string;
    accommodationType?: string;
    stayStartDate: string;
    stayNights: number;
    priceTotalGbp: number;
    sourceUrl: string;
    rawData?: Record<string, unknown>;
}
