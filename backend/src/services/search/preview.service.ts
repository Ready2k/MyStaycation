
import { AppDataSource } from '../../config/database';
import { HolidayProfile, AccommodationType } from '../../entities/HolidayProfile';
import { FetchRun, RunType, RunStatus } from '../../entities/FetchRun';
import { Provider } from '../../entities/Provider';
import { adapterRegistry } from '../../adapters/registry';
import { ResultMatcher, CandidateResult, MatchConfidence } from '../../utils/result-matcher';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { v4 as uuidv4 } from 'uuid';
import { generateSeriesKey } from '../../utils/series-key';

// Types from spec
export type PreviewMode = 'PROFILE_ID' | 'INLINE_PROFILE';

export interface PreviewRequest {
    mode: PreviewMode;
    profileId?: string;
    profile?: Partial<HolidayProfile>; // Inline profile
    providers?: string[];
    options?: PreviewOptions;
}

export interface PreviewOptions {
    maxResults?: number;
    enrichTopN?: number;
    allowWeakMatches?: boolean;
    includeMismatches?: boolean;
    includeDebug?: boolean;
}

export interface ProviderPreview {
    providerKey: string;
    status: string;
    timingMs: {
        fetch: number;
        parse: number;
        match: number;
        enrich: number;
        total: number;
    };
    compliance: {
        scrapingEnabled: boolean;
        robotsAllowed: boolean;
        playwrightUsed: boolean;
        rateLimited: boolean;
    };
    results: {
        matched: PreviewResult[];
        other: PreviewResult[];
    };
    summary: {
        totalCandidates: number;
        matchStrong: number;
        matchWeak: number;
        matchUnknown: number;
        mismatch: number;
        lowestMatchedPriceGbp: number | null;
    };
}

export interface PreviewResult {
    confidence: MatchConfidence;
    providerKey: string;
    sourceUrl: string;
    parkId: string;
    stayStartDate: string; // yyyy-mm-dd
    stayNights: number;
    accommodationType?: string;
    bedrooms?: number;
    tier?: string;
    petsAllowed?: boolean;
    facilities?: string[];
    availability: 'AVAILABLE' | 'SOLD_OUT' | 'UNKNOWN';
    price: {
        totalGbp: number;
        perNightGbp: number | null;
    };
    seriesKey: string;
    reasons: {
        passed: Reason[];
        failed: Reason[];
        unknown: Reason[];
        softNotes: Reason[];
    };
    matchDetails?: string;
}

export interface Reason {
    code: string;
    message: string;
    details?: any;
}

export interface PreviewResponse {
    requestId: string;
    generatedAt: string;
    mode: PreviewMode;
    profile: any;
    providers: ProviderPreview[];
    overallSummary: any;
    sideEffects: {
        observationsStored: boolean;
        alertsGenerated: boolean;
        emailsSent: boolean;
    };
    warnings: any[];
}

export class PreviewService {
    private fetchRunRepo = AppDataSource.getRepository(FetchRun);
    private providerRepo = AppDataSource.getRepository(Provider);
    private profileRepo = AppDataSource.getRepository(HolidayProfile);

    async executePreview(req: PreviewRequest): Promise<PreviewResponse> {
        const requestId = uuidv4();
        const generatedAt = new Date().toISOString();
        const providerPreviews: ProviderPreview[] = [];

        // 1. Resolve Profile
        let profile: HolidayProfile | Partial<HolidayProfile>;
        if (req.mode === 'PROFILE_ID') {
            if (!req.profileId) throw new Error('profileId required required for PROFILE_ID mode');
            const found = await this.profileRepo.findOne({ where: { id: req.profileId } });
            if (!found) throw new Error('Profile not found');
            profile = found;
        } else {
            if (!req.profile) throw new Error('profile payload required for INLINE_PROFILE mode');
            // Mock a profile object from payload
            profile = req.profile;
        }

        // 2. Determine Providers
        let providersToRun = req.providers && req.providers.length > 0
            ? req.providers
            : Array.from(adapterRegistry.getAllAdapters().keys());

        // Filter by profile's enabled providers if specified
        if (profile.enabledProviders && profile.enabledProviders.length > 0) {
            providersToRun = providersToRun.filter(p => profile.enabledProviders!.includes(p));
        }

        // Deduplicate providers to prevent running the same provider twice
        providersToRun = Array.from(new Set(providersToRun));
        console.log(`🔍 Running preview for providers: ${providersToRun.join(', ')}`);


        // 3. Run for each provider
        for (const providerKey of providersToRun) {
            const preview = await this.runSingleProvider(providerKey, profile, requestId, req.options);
            providerPreviews.push(preview);
        }

        // 4. Summarize
        const overallSummary = this.summarizeAll(providerPreviews);

        const response: PreviewResponse = {
            requestId,
            generatedAt,
            mode: req.mode,
            profile: {
                // Return sanitized profile structure
                ...profile
            },
            providers: providerPreviews,
            overallSummary,
            sideEffects: {
                observationsStored: false,
                alertsGenerated: false,
                emailsSent: false
            },
            warnings: []
        };

        return response;
    }

    private async runSingleProvider(
        providerKey: string,
        profile: any,
        requestId: string,
        options: PreviewOptions = {}
    ): Promise<ProviderPreview> {
        const startTotal = Date.now();
        const timing = { fetch: 0, parse: 0, match: 0, enrich: 0, total: 0 };
        const compliance = { scrapingEnabled: true, robotsAllowed: true, playwrightUsed: false, rateLimited: false };

        let status = 'OK';
        const results = { matched: [] as PreviewResult[], other: [] as PreviewResult[] };
        const summary = {
            totalCandidates: 0, matchStrong: 0, matchWeak: 0, matchUnknown: 0,
            mismatch: 0, lowestMatchedPriceGbp: null as number | null
        };

        // Check global kill switch
        if (process.env.SCRAPING_ENABLED === 'false') {
            status = 'DISABLED';
            compliance.scrapingEnabled = false;
            timing.total = Date.now() - startTotal;
            return { providerKey, status, timingMs: timing, compliance, results, summary };
        }

        // Get Adapter
        let adapter;
        try {
            adapter = adapterRegistry.getAdapter(providerKey);
        } catch (e) {
            status = 'ERROR'; // Adapter not found
            return { providerKey, status, timingMs: timing, compliance, results, summary };
        }

        if (!adapter.isEnabled()) {
            status = 'DISABLED';
            return { providerKey, status, timingMs: timing, compliance, results, summary };
        }

        // Prepare Search Params from Profile
        const adapterParams = {
            provider: providerKey,
            dateWindow: {
                start: profile.dateStart instanceof Date ? profile.dateStart.toISOString().split('T')[0] : profile.dateStart,
                end: profile.dateEnd instanceof Date ? profile.dateEnd.toISOString().split('T')[0] : profile.dateEnd
            },
            nights: { min: profile.durationNightsMin, max: profile.durationNightsMax },
            party: { adults: profile.partySizeAdults, children: profile.partySizeChildren },
            pets: profile.pets,
            park: undefined,
            region: profile.region,
            accommodation: profile.accommodationType,
            minBedrooms: profile.minBedrooms,
            peakTolerance: profile.peakTolerance || 'MIXED'
        };

        // FETCH
        const t0 = Date.now();
        let rawResults: any[] = [];
        try {
            rawResults = await adapter.search(adapterParams);
        } catch (e: any) {
            console.error(`Preview fetch failed for ${providerKey}`, e);
            status = 'FETCH_FAILED';
            if (e.message?.includes('robots')) status = 'BLOCKED_ROBOTS';
        }
        const timingMs = { ...timing, fetch: Date.now() - t0 };

        // MATCH
        const t1 = Date.now();
        summary.totalCandidates = rawResults.length;

        for (const candidate of rawResults) {
            // Classify
            const classification = ResultMatcher.classify(candidate, {
                targetData: {
                    dateStart: adapterParams.dateWindow.start,
                    nights: candidate.stayNights,
                    party: adapterParams.party,
                    pets: adapterParams.pets,
                    accommodationType: adapterParams.accommodation,
                    minBedrooms: adapterParams.minBedrooms
                } as any
            });

            let confidence = classification.confidence;
            const reasons = { passed: [], failed: [], unknown: [], softNotes: [] } as any;

            // Manual Date Range Check (since Matcher enforces exact)
            const resDate = new Date(candidate.stayStartDate);
            const profStart = new Date(adapterParams.dateWindow.start);
            const profEnd = new Date(adapterParams.dateWindow.end);

            let inDateRange = resDate >= profStart && resDate <= profEnd;
            if (!inDateRange) {
                confidence = MatchConfidence.MISMATCH;
                reasons.failed.push({ code: 'DATE_OUT_OF_RANGE', message: `Date ${candidate.stayStartDate} not in profile window` });
            } else {
                const context = {
                    targetData: {
                        dateStart: candidate.stayStartDate, // align
                        nights: candidate.stayNights,       // align
                        party: adapterParams.party,
                        pets: adapterParams.pets,
                        accommodationType: adapterParams.accommodation,
                        minBedrooms: adapterParams.minBedrooms
                    }
                };

                const strictMatch = ResultMatcher.classify(candidate, context);
                confidence = strictMatch.confidence;
                // Parse description into reasons (rudimentary)
                if (confidence === MatchConfidence.MISMATCH) {
                    reasons.failed.push({ code: 'MISMATCH', message: strictMatch.description });
                } else if (confidence === MatchConfidence.UNKNOWN) {
                    reasons.unknown.push({ code: 'UNKNOWN_DATA', message: strictMatch.description });
                } else {
                    reasons.passed.push({ code: 'MATCH', message: strictMatch.description });
                }
            }

            // SeriesKey Generation Safety
            const requiredFields = [candidate.stayStartDate, candidate.stayNights, candidate.accomType];
            const hasRequiredFields = requiredFields.every(f => f !== undefined && f !== null);

            let seriesKey = 'UNKNOWN_MISSING_DATA';
            if (hasRequiredFields) {
                try {
                    seriesKey = generateSeriesKey({
                        providerId: providerKey,
                        stayStartDate: candidate.stayStartDate,
                        stayNights: candidate.stayNights,
                        parkId: adapterParams.park || 'ANY',
                        accomTypeId: candidate.accomType
                    });
                } catch (err) {
                    reasons.failed.push({ code: 'SERIESKEY_GENERATION_FAILED', message: 'Failed to generate key' });
                }
            } else {
                reasons.failed.push({ code: 'SERIESKEY_INCOMPLETE', message: 'Missing critical fields' });
                if (confidence !== MatchConfidence.MISMATCH) {
                    confidence = MatchConfidence.UNKNOWN; // Downgrade if not already mismatch
                }
            }

            // Create PreviewResult
            const previewResult: PreviewResult = {
                confidence,
                providerKey,
                sourceUrl: candidate.sourceUrl,
                parkId: 'ANY',
                stayStartDate: candidate.stayStartDate,
                stayNights: candidate.stayNights,
                accommodationType: candidate.accomType,
                bedrooms: candidate.bedrooms,
                tier: undefined,
                petsAllowed: candidate.petsAllowed,
                facilities: [],
                availability: candidate.availability,
                price: {
                    totalGbp: candidate.priceTotalGbp,
                    perNightGbp: candidate.pricePerNightGbp
                },
                seriesKey,
                reasons,
                matchDetails: classification.description
            };

            // Summary Stats
            if (confidence === MatchConfidence.STRONG) summary.matchStrong++;
            else if (confidence === MatchConfidence.WEAK) summary.matchWeak++;
            else if (confidence === MatchConfidence.UNKNOWN) summary.matchUnknown++;
            else summary.mismatch++;

            // Bucket
            if (confidence === MatchConfidence.STRONG || (options.allowWeakMatches && confidence === MatchConfidence.WEAK)) {
                results.matched.push(previewResult);
                if (!summary.lowestMatchedPriceGbp || candidate.priceTotalGbp < summary.lowestMatchedPriceGbp) {
                    summary.lowestMatchedPriceGbp = candidate.priceTotalGbp;
                }
            } else {
                if (options.includeMismatches || options.includeDebug) {
                    results.other.push(previewResult);
                }
            }
        }
        timingMs.match = Date.now() - t1;
        timingMs.total = Date.now() - startTotal;

        // SORTING & LIMITING
        const sortOrder = profile.sortOrder || 'PRICE_ASC';
        results.matched.sort((a, b) => {
            if (sortOrder === 'PRICE_ASC') return a.price.totalGbp - b.price.totalGbp;
            if (sortOrder === 'PRICE_DESC') return b.price.totalGbp - a.price.totalGbp;
            if (sortOrder === 'DATE_ASC') return new Date(a.stayStartDate).getTime() - new Date(b.stayStartDate).getTime();
            return 0;
        });

        // Apply Max Results
        const effectiveMax = options.maxResults || profile.maxResults || 20;
        if (results.matched.length > effectiveMax) {
            results.matched = results.matched.slice(0, effectiveMax);
        }

        // Audit Log - Always log for preview
        await this.logRun(providerKey, profile, status, rawResults.length, summary);

        return {
            providerKey,
            status,
            timingMs,
            compliance,
            results,
            summary
        };
    }

    private async logRun(providerKey: string, profile: any, status: string, count: number, summary: any) {
        // Find Provider Entity
        const provider = await this.providerRepo.findOne({ where: { code: providerKey } });
        if (!provider) return;

        const run = this.fetchRunRepo.create({
            provider,
            runType: RunType.MANUAL_PREVIEW,
            scheduledFor: new Date(),
            startedAt: new Date(),
            finishedAt: new Date(),
            status: status === 'OK' ? RunStatus.OK : RunStatus.ERROR,
            responseSnapshotRef: JSON.stringify({
                summary,
                parseStats: {
                    total: count,
                    matched: summary.matchStrong + summary.matchWeak
                }
            })
        });

        await this.fetchRunRepo.save(run);
    }

    private summarizeAll(previews: ProviderPreview[]) {
        return {
            providersRequested: previews.length,
            providersSucceeded: previews.filter(p => p.status === 'OK').length,
            providersFailed: previews.filter(p => p.status !== 'OK').length,
            totalMatched: previews.reduce((sum, p) => sum + p.results.matched.length, 0),
            lowestMatchedPriceGbp: previews.reduce((min, p) => {
                if (p.summary.lowestMatchedPriceGbp === null) return min;
                if (min === null) return p.summary.lowestMatchedPriceGbp;
                return Math.min(min, p.summary.lowestMatchedPriceGbp);
            }, null as number | null)
        };
    }
}

export const previewService = new PreviewService();
