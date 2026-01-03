import * as crypto from 'crypto';

/**
 * Generate a deterministic series key for like-for-like price comparisons
 * 
 * A series key identifies a bookable stay with:
 * - Same provider
 * - Same stay start date
 * - Same duration (nights)
 * - Same park (if applicable)
 * - Same accommodation type (if applicable)
 */
export function generateSeriesKey(params: {
    providerId: string;
    stayStartDate: string; // YYYY-MM-DD
    stayNights: number;
    parkId?: string;
    accomTypeId?: string;
}): string {
    const components = [
        params.providerId,
        params.stayStartDate,
        params.stayNights.toString(),
        params.parkId || 'ANY',
        params.accomTypeId || 'ANY',
    ];

    const concatenated = components.join('|');
    return crypto.createHash('sha256').update(concatenated).digest('hex');
}

/**
 * Generate a deduplication key for insights
 * Prevents duplicate insights for the same series and time window
 */
export function generateInsightDedupeKey(params: {
    fingerprintId: string;
    seriesKey: string;
    insightType: string;
    windowIdentifier: string; // e.g., 'LOWEST_180D', 'PRICE_DROP', 'RISK_RISING'
}): string {
    const components = [
        params.fingerprintId,
        params.seriesKey,
        params.insightType,
        params.windowIdentifier,
    ];

    const concatenated = components.join('|');
    return crypto.createHash('sha256').update(concatenated).digest('hex');
}
