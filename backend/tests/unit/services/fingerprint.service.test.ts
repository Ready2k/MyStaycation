import { FingerprintService } from '../../../src/services/search/fingerprint.service';
import { HolidayProfile, FlexType, PeakTolerance, AccommodationType } from '../../../src/entities/HolidayProfile';
import { Provider } from '../../../src/entities/Provider';
import { SearchFingerprint } from '../../../src/entities/SearchFingerprint';
import { AppDataSource } from '../../../src/config/database';

// Mock dependencies
jest.mock('../../../src/config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

describe('FingerprintService', () => {
    let service: FingerprintService;
    let mockFingerprintRepo: any;
    let mockProviderRepo: any;

    beforeEach(() => {
        // Reset mocks
        mockFingerprintRepo = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                AndWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            }))
        };
        mockProviderRepo = {
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([
                    { id: 'p1', code: 'hoseasons' },
                    { id: 'p2', code: 'parkdean' }
                ]) // Default mock returns providers
            }))
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity === SearchFingerprint) return mockFingerprintRepo;
            if (entity === Provider) return mockProviderRepo;
            return {};
        });

        // Initialize service (it grabs repos in constructor/init, so we might need to recreate it or rely on imports)
        // Since the service instantiates repos as properties, we need to ensure mocks are ready before import or use a fresh instance logic if possible.
        // But since we can't easily re-import, we rely on the fact that if we use the class, it will call getRepository.
        service = new FingerprintService();
    });

    it('should generate fingerprints for enabled providers', async () => {
        const profile = {
            id: 'prof-123',
            name: 'Cornwall Trip',
            partySizeAdults: 2,
            partySizeChildren: 2,
            dateStart: new Date('2025-08-01'),
            durationNightsMin: 7,
            durationNightsMax: 7,
            enabledProviders: ['hoseasons', 'parkdean'],
            enabled: true,
            pets: false,
            minBedrooms: 2,
            peakTolerance: PeakTolerance.PEAK_OK,
            accommodationType: AccommodationType.LODGE,
            region: 'Cornwall'
        } as HolidayProfile;

        // Mock findOne to return null (no existing fingerprint)
        mockFingerprintRepo.findOne.mockResolvedValue(null);
        mockFingerprintRepo.create.mockImplementation((data: any) => ({ ...data, id: 'fp-new' }));

        await service.syncProfileFingerprints(profile);

        // Should look for providers
        expect(mockProviderRepo.createQueryBuilder).toHaveBeenCalled();

        // Should create 2 fingerprints (hoseasons, parkdean)
        expect(mockFingerprintRepo.create).toHaveBeenCalledTimes(2);
        expect(mockFingerprintRepo.save).toHaveBeenCalledTimes(2);

        // Verify content of creation
        const createCallArg = mockFingerprintRepo.create.mock.calls[0][0];
        expect(createCallArg.profile.id).toBe('prof-123');
        expect(createCallArg.enabled).toBe(true);
        expect(createCallArg.canonicalJson.provider).toBeDefined();
    });
});
