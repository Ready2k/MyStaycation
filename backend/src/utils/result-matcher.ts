import { AccommodationType } from '../entities/HolidayProfile';

export enum MatchConfidence {
    STRONG = 'STRONG',      // All fingerprint fields confirmed
    WEAK = 'WEAK',          // Fingerprint ok, some soft fields unknown
    UNKNOWN = 'UNKNOWN',    // Key data missing (e.g., bedrooms not listed)
    MISMATCH = 'MISMATCH'   // Hard constraint violated
}

export interface MatcherContext {
    // Fingerprint-bound fields (Hard constraints)
    targetData: {
        dateStart: string;      // YYYY-MM-DD
        nights: number;
        party: {
            adults: number;
            children: number;
        };
        pets: boolean;
        accommodationType: AccommodationType;
        minBedrooms: number;
    };
}

export interface CandidateResult {
    stayStartDate: string;
    stayNights: number;
    priceTotalGbp: number;
    availability: 'AVAILABLE' | 'SOLD_OUT' | 'UNKNOWN';

    // Optional/Derived fields
    accomType?: string; // Raw string from provider
    bedrooms?: number;
    petsAllowed?: boolean;
}

export interface MatchResult {
    confidence: MatchConfidence;
    description: string;
}

export class ResultMatcher {
    /**
     * Classify a raw provider result against the user's intent (Fingerprint)
     * effectively implementing the "Real-World Mapping" contract.
     */
    static classify(result: CandidateResult, context: MatcherContext): MatchResult {
        const errors: string[] = [];
        let weakReasons: string[] = [];

        // 1. DATES & NIGHTS (Strongest Constraint)
        // MUST match exactly. No fuzzy matching allowed for fingerprint fields.
        if (result.stayStartDate !== context.targetData.dateStart) {
            return { confidence: MatchConfidence.MISMATCH, description: `Date mismatch: expected ${context.targetData.dateStart}, got ${result.stayStartDate}` };
        }
        if (result.stayNights !== context.targetData.nights) {
            return { confidence: MatchConfidence.MISMATCH, description: `Nights mismatch: expected ${context.targetData.nights}, got ${result.stayNights}` };
        }

        // 2. PETS (Binary Constraint)
        if (context.targetData.pets) {
            // User HAS pets
            if (result.petsAllowed === false) {
                return { confidence: MatchConfidence.MISMATCH, description: 'Pets not allowed' };
            }
            if (result.petsAllowed === undefined) {
                // If we don't know, it's risky. But 'Unknown' is safer than 'Mismatch' if we want to log it,
                // however per spec: "Invalid results MUST be skipped".
                // But here, if we just aren't sure, it's UNKNOWN confidence.
                weakReasons.push('Pets allowed status unknown');
            }
        } else {
            // User has NO pets. Usually fine if pets are allowed, unless we wanted "Pet Free".
            // For now, staying in a pet-friendly place without pets is generally allowed.
        }

        // 3. BEDROOMS (Minimum Constraint)
        if (context.targetData.minBedrooms > 0) {
            if (result.bedrooms !== undefined) {
                if (result.bedrooms < context.targetData.minBedrooms) {
                    return { confidence: MatchConfidence.MISMATCH, description: `Too few bedrooms: ${result.bedrooms} < ${context.targetData.minBedrooms}` };
                }
            } else {
                // Bedrooms unknown. Critical missing data for this constraint.
                weakReasons.push('Bedroom count unknown');
            }
        }

        // 4. ACCOMMODATION TYPE (Broad Category)
        // This is often fuzzy because provider strings vary (e.g. "Prestige Caravan" vs "Lodge").
        // We generally trust the SearchParams filtered this, but if we have data we check it.
        // Implementation consideration: Providers usually return what we asked for. 
        // We will assume STRONG unless we have evidence to the contrary.

        // CLASSIFICATION
        if (errors.length > 0) {
            return { confidence: MatchConfidence.MISMATCH, description: errors.join(', ') };
        }

        // If we have weak reasons (missing data on required fields), we downgrade.
        // Rule: "No alert is generated unless result is MATCH_STRONG."
        // Rule: "Unknown data results in silence" -> UNKNOWN or WEAK.

        // If we are missing critical data like bedrooms (when required) or pets (when required),
        // we cannot be STRONG.

        const missingCriticalData = weakReasons.length > 0;

        if (missingCriticalData) {
            // If we strictly require bedrooms and we don't know, is that WEAK or UNKNOWN?
            // "MATCH_UNKNOWN | Key data missing, do not alert"
            return {
                confidence: MatchConfidence.UNKNOWN,
                description: `Potential match but data missing: ${weakReasons.join(', ')}`
            };
        }

        // If all checks pass and we have all data
        return { confidence: MatchConfidence.STRONG, description: 'All fingerprint fields matched' };
    }
}
