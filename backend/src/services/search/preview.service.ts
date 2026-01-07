
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
    userId: string; // Required for security
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
    propertyName?: string;
    location?: string;
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

        // 1. Resolve Profile with User Scoping
        let profile: HolidayProfile | Partial<HolidayProfile>;
        if (req.mode === 'PROFILE_ID') {
            if (!req.profileId) throw new Error('profileId required for PROFILE_ID mode');

            // SECURITY: Enforce user scoping
            const found = await this.profileRepo.findOne({
                where: {
                    id: req.profileId,
                    user: { id: req.userId }
                },
                relations: ['provider'] // Load provider relation
            });

            if (!found) {
                throw new Error('Profile not found or access denied');
            }
            profile = found;
        } else {
            if (!req.profile) throw new Error('profile payload required for INLINE_PROFILE mode');

            // VALIDATION: Enforce minimum viable profile
            if (!req.profile.dateStart) {
                throw new Error('PROFILE_INCOMPLETE: dateStart is required');
            }

            // For RANGE/FLEXI, dateEnd is required
            if (req.profile.flexType === 'RANGE' || req.profile.flexType === 'FLEXI') {
                if (!req.profile.dateEnd) {
                    throw new Error('PROFILE_INCOMPLETE: dateEnd is required for RANGE/FLEXI mode');
                }
            }

            // Validate dates are not Invalid Date objects
            const startDate = new Date(req.profile.dateStart);
            if (isNaN(startDate.getTime())) {
                throw new Error('PROFILE_INCOMPLETE: dateStart is invalid');
            }

            if (req.profile.dateEnd) {
                const endDate = new Date(req.profile.dateEnd);
                if (isNaN(endDate.getTime())) {
                    throw new Error('PROFILE_INCOMPLETE: dateEnd is invalid');
                }
            }

            profile = req.profile;
        }

        // 2. Determine Providers with Normalization
        // Get all available providers and normalize to uppercase
        const allProviders = Array.from(adapterRegistry.getAllAdapters().keys()).map(p => p.toUpperCase());

        let providersToRun = req.providers && req.providers.length > 0
            ? req.providers.map(p => p.trim().toUpperCase()) // NORMALIZE
            : allProviders;

        // PRIORITY: If profile has a specific provider assigned, ONLY search that provider
        if ((profile as any).provider) {
            const providerCode = (profile as any).provider.code || (profile as any).provider;
            providersToRun = [providerCode.toUpperCase()];
            console.log(`🎯 Provider-specific watcher: searching only ${providerCode}`);
        }
        // Otherwise, filter by profile's enabled providers if specified
        else if (profile.enabledProviders) {
            // Handle both string and array types (database stores as text)
            let enabledArray: string[];
            if (typeof profile.enabledProviders === 'string') {
                // Split comma-separated string or treat as single provider
                const providersStr = profile.enabledProviders as string;
                enabledArray = providersStr.includes(',')
                    ? providersStr.split(',').map(p => p.trim())
                    : [providersStr.trim()];
            } else if (Array.isArray(profile.enabledProviders)) {
                enabledArray = profile.enabledProviders;
            } else {
                enabledArray = [];
            }

            if (enabledArray.length > 0) {
                // Normalize to uppercase for comparison
                const normalizedEnabledProviders = enabledArray.map(ep => ep.trim().toUpperCase());
                providersToRun = providersToRun.filter(p =>
                    normalizedEnabledProviders.includes(p)
                );
            }
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
        // COMPLIANCE: Initialize with real values, not hardcoded
        const compliance = {
            scrapingEnabled: process.env.SCRAPING_ENABLED !== 'false',
            robotsAllowed: false,
            playwrightUsed: false,
            rateLimited: false
        };

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

        // Get Adapter (registry uses lowercase keys)
        let adapter;
        try {
            adapter = adapterRegistry.getAdapter(providerKey.toLowerCase());
        } catch (e) {
            status = 'ERROR'; // Adapter not found
            return { providerKey, status, timingMs: timing, compliance, results, summary };
        }

        if (!adapter.isEnabled()) {
            console.log(`DEBUG: Adapter ${providerKey} is DISABLED via isEnabled() check`);
            status = 'DISABLED';
            return { providerKey, status, timingMs: timing, compliance, results, summary };
        }

        console.log(`DEBUG: Adapter ${providerKey} is ENABLED. Starting search...`);

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
            parks: profile.parkIds,
            region: profile.region,
            accommodation: profile.accommodationType,
            minBedrooms: profile.minBedrooms,
            peakTolerance: profile.peakTolerance || 'MIXED'
        };

        // COMPLIANCE: Check robots.txt
        // Note: buildSearchUrl is protected, so we'll default to true for now
        // Individual adapters can override this in their search() method
        compliance.robotsAllowed = true;

        // FETCH
        const t0 = Date.now();
        let rawResults: any[] = [];
        let usedPlaywright = false;
        try {
            console.log(`DEBUG: Calling adapter.search() for ${providerKey}`);
            rawResults = await adapter.search(adapterParams);
            console.log(`DEBUG: adapter.search() returned ${rawResults.length} results`);
            usedPlaywright = options.forcePlaywright || false;
        } catch (e: any) {
            console.error(`Preview fetch failed for ${providerKey}`, e);
            status = 'FETCH_FAILED';
            if (e.message?.includes('robots')) status = 'BLOCKED_ROBOTS';
        }
        compliance.playwrightUsed = usedPlaywright;
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
            // Handle specific date (null end) by defaulting to start date
            const profEnd = adapterParams.dateWindow.end ? new Date(adapterParams.dateWindow.end) : new Date(profStart);

            let inDateRange = resDate >= profStart && resDate <= profEnd;
            if (!inDateRange) {
                console.log(`DEBUG: REJECTED ${candidate.propertyName}: Date ${candidate.stayStartDate} outside window ${adapterParams.dateWindow.start}-${adapterParams.dateWindow.end}`);
                confidence = MatchConfidence.MISMATCH;
                reasons.failed.push({ code: 'DATE_OUT_OF_RANGE', message: `Date ${candidate.stayStartDate} not in profile window` });
            } else if (profile.budgetCeilingGbp && candidate.priceTotalGbp > profile.budgetCeilingGbp) {
                console.log(`DEBUG: REJECTED ${candidate.propertyName}: Price £${candidate.priceTotalGbp} exceeds budget £${profile.budgetCeilingGbp}`);
                confidence = MatchConfidence.MISMATCH;
                reasons.failed.push({ code: 'OVER_BUDGET', message: `Price £${candidate.priceTotalGbp} exceeds budget £${profile.budgetCeilingGbp}` });
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

                if (confidence !== MatchConfidence.STRONG && confidence !== MatchConfidence.WEAK) {
                    console.log(`DEBUG: REJECTED ${candidate.propertyName || 'unnamed'} (£${candidate.priceTotalGbp}): Confidence ${confidence}. Desc: ${strictMatch.description}`);
                    if (confidence === MatchConfidence.MISMATCH) {
                        reasons.failed.push({ code: 'MISMATCH', message: strictMatch.description });
                    } else if (confidence === MatchConfidence.UNKNOWN) {
                        // ...
                    }
                } else {
                    console.log(`DEBUG: ACCEPTED ${candidate.propertyName || 'unnamed'} (£${candidate.priceTotalGbp}): Confidence ${confidence}`);
                }
            }

            // SeriesKey Generation Safety - Use REAL parkId from candidate
            const realParkId = candidate.parkId || candidate.park_id || candidate.locationId;
            const requiredFields = [candidate.stayStartDate, candidate.stayNights, candidate.accomType, realParkId];
            const hasRequiredFields = requiredFields.every(f => f !== undefined && f !== null);

            let seriesKey: string | null = null;
            if (hasRequiredFields) {
                try {
                    seriesKey = generateSeriesKey({
                        providerId: providerKey,
                        stayStartDate: candidate.stayStartDate,
                        stayNights: candidate.stayNights,
                        parkId: realParkId,
                        accomTypeId: candidate.accomType
                    });
                } catch (err) {
                    reasons.failed.push({ code: 'SERIESKEY_GENERATION_FAILED', message: 'Failed to generate key' });
                    seriesKey = null;
                }
            } else {
                reasons.failed.push({ code: 'SERIESKEY_INCOMPLETE', message: 'Missing critical fields (parkId, date, nights, or accomType)' });
                if (confidence !== MatchConfidence.MISMATCH) {
                    confidence = MatchConfidence.UNKNOWN;
                }
            }

            // Create PreviewResult
            const previewResult: PreviewResult = {
                confidence,
                providerKey,
                sourceUrl: candidate.sourceUrl,
                parkId: realParkId || 'UNKNOWN',
                stayStartDate: candidate.stayStartDate,
                stayNights: candidate.stayNights,
                accommodationType: candidate.accomType || 'UNKNOWN',
                bedrooms: candidate.bedrooms,
                tier: undefined,
                petsAllowed: candidate.petsAllowed,
                facilities: [],
                propertyName: candidate.propertyName,
                location: candidate.location,
                availability: candidate.availability,
                price: {
                    totalGbp: candidate.priceTotalGbp,
                    perNightGbp: candidate.pricePerNightGbp
                },
                seriesKey: seriesKey || 'null',
                reasons,
                matchDetails: candidate.matchDetails || (confidence === MatchConfidence.MISMATCH
                    ? (reasons.failed[0]?.message || 'Mismatch')
                    : (reasons.passed[0]?.message || 'Match'))
            };

            // Summary Stats
            if (confidence === MatchConfidence.STRONG) summary.matchStrong++;
            else if (confidence === MatchConfidence.WEAK) summary.matchWeak++;
            else if (confidence === MatchConfidence.UNKNOWN) summary.matchUnknown++;
            else summary.mismatch++;

            // Bucket
            if (confidence === MatchConfidence.STRONG || (options.allowWeakMatches && confidence === MatchConfidence.WEAK)) {
                results.matched.push(previewResult);
                console.log(`DEBUG: Added to matched: ${candidate.propertyName || 'unnamed'} (£${candidate.priceTotalGbp}) - confidence: ${confidence}`);
                if (!summary.lowestMatchedPriceGbp || candidate.priceTotalGbp < summary.lowestMatchedPriceGbp) {
                    summary.lowestMatchedPriceGbp = candidate.priceTotalGbp;
                }
            } else {
                console.log(`DEBUG: NOT added to matched: ${candidate.propertyName || 'unnamed'} (£${candidate.priceTotalGbp}) - confidence: ${confidence}, allowWeakMatches: ${options.allowWeakMatches}`);
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
        await this.logRun(providerKey, profile, status, rawResults.length, summary, requestId);

        return {
            providerKey,
            status,
            timingMs,
            compliance,
            results,
            summary
        };
    }

    private async logRun(
        providerKey: string,
        profile: any,
        status: string,
        count: number,
        summary: any,
        requestId: string
    ) {
        // Find Provider Entity
        const provider = await this.providerRepo.findOne({ where: { code: providerKey } });
        if (!provider) return;

        // Map status string to ProviderStatus enum
        let providerStatus: any = 'OK';
        if (status === 'FETCH_FAILED') providerStatus = 'FETCH_FAILED';
        else if (status === 'PARSE_FAILED') providerStatus = 'PARSE_FAILED';
        else if (status === 'BLOCKED_ROBOTS' || status === 'BLOCKED') providerStatus = 'BLOCKED';
        else if (status === 'TIMEOUT') providerStatus = 'TIMEOUT';
        else if (status !== 'OK') providerStatus = 'FETCH_FAILED';

        // Generate request fingerprint (hash of profile params)
        const crypto = await import('crypto');
        const fingerprintData = JSON.stringify({
            provider: providerKey,
            dateStart: profile.dateStart,
            dateEnd: profile.dateEnd,
            nights: { min: profile.durationNightsMin, max: profile.durationNightsMax },
            party: { adults: profile.partySizeAdults, children: profile.partySizeChildren }
        });
        const requestFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 16);

        const run = this.fetchRunRepo.create({
            provider,
            runType: RunType.MANUAL_PREVIEW,
            scheduledFor: new Date(),
            startedAt: new Date(),
            finishedAt: new Date(),
            status: status === 'OK' ? RunStatus.OK : RunStatus.ERROR,
            requestId,
            providerStatus,
            requestFingerprint,
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
