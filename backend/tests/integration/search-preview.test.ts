import { PreviewService, previewService } from '../../src/services/search/preview.service';
import { AppDataSource } from '../../src/config/database';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import * as dotenv from 'dotenv';
import { adapterRegistry } from '../../src/adapters/registry';
import { AccommodationType } from '../../src/entities/HolidayProfile';
import { MockProviderAdapter } from '../../src/services/search/MockProvider';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
        isInitialized: true
    }
}));

jest.mock('../../src/adapters/registry', () => ({
    adapterRegistry: {
        getAllAdapters: jest.fn(),
        getAdapter: jest.fn()
    }
}));

describe('Search Preview Unit Test', () => {
    let service: PreviewService;
    let mockFetchRunRepo: any;
    let mockProviderRepo: any;
    let mockProfileRepo: any;
    let mockAdapter: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Repository Mocks
        mockFetchRunRepo = {
            create: jest.fn().mockImplementation(() => ({ id: 'run-1' })),
            save: jest.fn().mockImplementation(() => Promise.resolve({ id: 'run-1' })),
            findOne: jest.fn()
        };
        mockProviderRepo = {
            findOne: jest.fn().mockImplementation(() => Promise.resolve({ id: 'prov-1', code: 'haven' }))
        };
        mockProfileRepo = {
            findOne: jest.fn()
        };

        // Setup AppDataSource.getRepository behavior
        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            if (entity.name === 'FetchRun') return mockFetchRunRepo;
            if (entity.name === 'Provider') return mockProviderRepo;
            if (entity.name === 'HolidayProfile') return mockProfileRepo;
            return { findOne: jest.fn() };
        });

        // Setup Adapter Logic
        mockAdapter = {
            isEnabled: jest.fn().mockReturnValue(true),
            search: jest.fn().mockImplementation(() => Promise.resolve([{
                stayStartDate: '2026-06-10',
                stayNights: 4,
                priceTotalGbp: 500,
                pricePerNightGbp: 125,
                availability: 'AVAILABLE',
                sourceUrl: 'http://example.com',
                accomType: 'Caravan',
                bedrooms: 2,
                petsAllowed: false
            }]))
        };

        (adapterRegistry.getAdapter as jest.Mock).mockReturnValue(mockAdapter);
        (adapterRegistry.getAllAdapters as jest.Mock).mockReturnValue(new Map([['haven', mockAdapter]]));

        // Instantiate service AFTER mocks are set up
        service = new PreviewService();
    });

    it('should run a preview in INLINE_PROFILE mode', async () => {
        const response = await service.executePreview({
            mode: 'INLINE_PROFILE',
            userId: 'test-user-id',
            profile: {
                dateStart: new Date('2026-06-01'),
                dateEnd: new Date('2026-06-30'),
                durationNightsMin: 3,
                durationNightsMax: 7,
                partySizeAdults: 2,
                partySizeChildren: 0,
                pets: false,
                accommodationType: AccommodationType.CARAVAN,
                minBedrooms: 2
            },
            providers: ['haven'],
            options: { includeDebug: true } // Renamed from dryRun
        });

        // Assertions
        expect(response).toBeDefined();
        expect(response.mode).toBe('INLINE_PROFILE');
        expect(response.providers).toHaveLength(1);
        expect(response.providers[0].providerKey).toBe('haven');
        expect(response.providers[0].status).toBe('OK');

        // Site Effects Verification (1.1, 2.1)
        expect(response.sideEffects).toEqual({
            observationsStored: false,
            alertsGenerated: false,
            emailsSent: false
        });

        // Verify Adapter was called
        expect(adapterRegistry.getAdapter).toHaveBeenCalledWith('haven');
        expect(mockAdapter.search).toHaveBeenCalled();

        // Verify Results
        const results = response.providers[0].results.matched;
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].price.totalGbp).toBe(500);
        expect(results[0].confidence).toBe('STRONG');

        // Verify Audit Log (1.3, 3.1)
        expect(mockFetchRunRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            runType: 'MANUAL_PREVIEW',
            responseSnapshotRef: expect.stringContaining('parseStats') // Verify stats capture
        }));
        expect(mockFetchRunRepo.save).toHaveBeenCalled();
    });

    it('should handle adapter fetch errors gracefully and still audit (1.3)', async () => {
        mockAdapter.search.mockRejectedValue(new Error('Network error'));

        const response = await service.executePreview({
            mode: 'INLINE_PROFILE',
            userId: 'test-user-id',
            profile: {
                dateStart: new Date('2026-06-01'),
                dateEnd: new Date('2026-06-05'),
                durationNightsMin: 3,
                durationNightsMax: 7,
                partySizeAdults: 2,
                pets: false,
                accommodationType: AccommodationType.ANY,
                minBedrooms: 0
            },
            providers: ['haven']
        });

        expect(response.providers[0].status).toBe('FETCH_FAILED');
        expect(response.providers[0].results.matched).toHaveLength(0);

        // Audit must still happen
        expect(mockFetchRunRepo.create).toHaveBeenCalled();
        expect(mockFetchRunRepo.save).toHaveBeenCalled();
    });

    it('should handle incomplete data from adapter (1.4)', async () => {
        // Mock adapter returning incomplete data that would break seriesKey if not handled
        mockAdapter.search.mockImplementation(() => Promise.resolve([{
            stayStartDate: '2026-06-10',
            // stayNights MISSING
            priceTotalGbp: 500,
            availability: 'AVAILABLE'
        } as any]));

        // We expect PreviewService to NOT crash.
        // And results to probably be UNKNOWN or MISMATCH.

        const response = await service.executePreview({
            mode: 'INLINE_PROFILE',
            userId: 'test-user-id',
            profile: { dateStart: new Date('2026-06-01') } as any,
            providers: ['haven'],
            options: { includeDebug: true }
        });

        const res = response.providers[0].results;
        // Should be in 'other' (mismatch/unknown) or matched depending on confidence.
        // ResultMatcher checks strict fields. Missing nights -> UNKNOWN/MISMATCH.

        const allResults = [...res.matched, ...res.other];
        expect(allResults.length).toBe(1);

        // Check seriesKey. If logic is naive, it might be a weird hash or crash.
        // We want it to be handled safely.
        // Currently seriesKey generation concatenates. 'undefined' -> 'undefined' string or crash?
        // Let's verify what happens.
        // Ideally we want to prevent partial results from having a seriesKey if they are not series-identifiable.
    });

    it('should NOT access PriceObservation repository (1.1)', async () => {
        // This is implicitly verified because we mocked request to GetRepository and only provided 3: FetchRun, Provider, Profile.
        // If the service requested PriceObservation, our mock implementation:
        // (AppDataSource.getRepository as jest.Mock).mockImplementation ... 
        // would return { findOne: jest.fn() } by default (fallback).
        // Best proof is to spy on the getRepository call itself and assert it wasn't called with PriceObservation entity.

        // Reset mocks to track calls fresh
        (AppDataSource.getRepository as jest.Mock).mockClear();

        await service.executePreview({
            mode: 'INLINE_PROFILE',
            userId: 'test-user-id',
            profile: { dateStart: '2026-06-01' } as any,
            providers: ['haven']
        });

        // We expect calls for FetchRun, Provider, Profile(maybe if needed).
        // But NOT PriceObservation.
        const calls = (AppDataSource.getRepository as jest.Mock).mock.calls;
        const requestedEntities = calls.map((c: any) => c[0]?.name);

        // Check that 'PriceObservation' is NOT in the requested entities
        expect(requestedEntities).not.toContain('PriceObservation');
    });
});
