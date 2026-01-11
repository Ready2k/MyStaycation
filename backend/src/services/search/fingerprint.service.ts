import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { HolidayProfile } from '../../entities/HolidayProfile';
import { Provider } from '../../entities/Provider';
import * as crypto from 'crypto';

export class FingerprintService {
    private fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
    private providerRepo = AppDataSource.getRepository(Provider);

    /**
     * Generate or update fingerprints for a profile
     * This should be called whenever a profile is created or updated
     */
    async syncProfileFingerprints(profile: HolidayProfile): Promise<SearchFingerprint[]> {
        console.log(`🔒 Syncing fingerprints for profile ${profile.id} (${profile.name})`);

        // 1. Identify enabled providers
        let providerCodes: string[] = [];

        // Check if this is a provider-specific watcher (has profile.provider set)
        if ((profile as any).provider) {
            const providerCode = (profile as any).provider.code || (profile as any).provider;
            providerCodes = [providerCode.toLowerCase()];
            console.log(`   Provider-specific watcher for: ${providerCode}`);
        }
        // Otherwise check enabledProviders array
        else if (profile.enabledProviders && profile.enabledProviders.length > 0) {
            providerCodes = profile.enabledProviders.map(p => p.toLowerCase());
        }

        if (providerCodes.length === 0) {
            console.log('   No providers enabled for this profile. Disabling all fingerprints.');
            await this.disableAllForProfile(profile.id);
            return [];
        }

        // 2. Resolve Providers from DB
        const providers = await this.providerRepo.createQueryBuilder('p')
            .where('LOWER(p.code) IN (:...codes)', { codes: providerCodes })
            .getMany();

        if (providers.length === 0) {
            console.warn('   No matching provider entities found in DB for codes:', providerCodes);
            return [];
        }

        // 3. For each provider, generate canonical fingerprint
        const fingerprints: SearchFingerprint[] = [];
        for (const provider of providers) {
            const fingerprint = await this.ensureFingerprint(profile, provider);
            if (fingerprint) fingerprints.push(fingerprint);
        }

        // 4. Disable fingerprints for this profile that are NOT in the active "just generated" list
        const activeIds = fingerprints.map(f => f.id);
        await this.disableStaleFingerprints(profile.id, activeIds);

        return fingerprints;
    }

    private async ensureFingerprint(profile: HolidayProfile, provider: Provider): Promise<SearchFingerprint | null> {
        // Generate canonical JSON based on profile settings & provider
        // This MUST match what the Adapter expects in SearchParams
        const searchParams = {
            provider: provider.code,
            party: {
                adults: profile.partySizeAdults,
                children: profile.partySizeChildren
            },
            dateWindow: {
                start: profile.dateStart, // ISO string or Date
                end: profile.dateEnd
            },
            nights: {
                min: profile.durationNightsMin,
                max: profile.durationNightsMax
            },
            pets: profile.pets,
            minBedrooms: profile.minBedrooms,
            peakTolerance: profile.peakTolerance,
            region: profile.region,
            metadata: profile.metadata || {}, // Include metadata for provider-specific settings
            // Add park IDs if specific to this provider?
            // Currently profile.parkIds is a flat list. Dealing with multi-provider park IDs is complex.
            // For now, if provider is Hoseasons and we have park IDs, pass them?
            // Ideally we need a mapping. Assuming generic region search for now unless specific
        };

        // If specific parks are mapped, they should be added here.
        // For MVP, we pass the profile's parkIds array if it exists.
        // Adapters should handle / ignore invalid IDs or we filter them if we had metadata.
        if (profile.parkIds && profile.parkIds.length > 0) {
            // TODO: In future, filter to only IDs belonging to this provider
            (searchParams as any).parks = profile.parkIds;
        }

        const canonicalJson = JSON.parse(JSON.stringify(searchParams)); // Ensure pure JSON object
        const canonicalString = JSON.stringify(canonicalJson, Object.keys(canonicalJson).sort());
        const canonicalHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

        // Check if exists
        let fingerprint = await this.fingerprintRepo.findOne({
            where: {
                profile: { id: profile.id },
                provider: { id: provider.id },
                canonicalHash
            },
            relations: ['provider'] // Load provider relation
        });

        if (fingerprint) {
            // Already exists, ensure it's enabled
            if (!fingerprint.enabled) {
                fingerprint.enabled = true;
                await this.fingerprintRepo.save(fingerprint);
                console.log(`   Re-enabled existing fingerprint ${fingerprint.id.slice(0, 8)}`);
            }
            return fingerprint;
        } else {
            // Create new
            fingerprint = this.fingerprintRepo.create({
                profile,
                provider,
                canonicalHash,
                canonicalJson,
                enabled: true,
                checkFrequencyHours: profile.user?.defaultCheckFrequencyHours || 48
            });
            await this.fingerprintRepo.save(fingerprint);
            console.log(`   Created new fingerprint ${fingerprint.id.slice(0, 8)} for ${provider.code}`);
            return fingerprint;
        }
    }

    private async disableAllForProfile(profileId: string): Promise<void> {
        await this.fingerprintRepo.update(
            { profile: { id: profileId } },
            { enabled: false }
        );
    }

    private async disableStaleFingerprints(profileId: string, activeIds: string[]): Promise<void> {
        if (activeIds.length === 0) {
            await this.disableAllForProfile(profileId);
            return;
        }

        const result = await this.fingerprintRepo.createQueryBuilder()
            .update(SearchFingerprint)
            .set({ enabled: false })
            .where("profile = :profileId", { profileId })
            .andWhere("enabled = :enabled", { enabled: true })
            .andWhere("id NOT IN (:...ids)", { ids: activeIds })
            .execute();

        if (result.affected && result.affected > 0) {
            console.log(`   Disabled ${result.affected} stale fingerprints (parameter mismatch)`);
        }
    }
}

export const fingerprintService = new FingerprintService();
