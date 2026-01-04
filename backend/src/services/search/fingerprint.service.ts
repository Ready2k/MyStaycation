import { AppDataSource } from '../../config/database';
import { SearchFingerprint } from '../../entities/SearchFingerprint';
import { HolidayProfile } from '../../entities/HolidayProfile';
import { Provider } from '../../entities/Provider';
import { adapterRegistry } from '../../adapters/registry';
import * as crypto from 'crypto';

export class FingerprintService {
    private fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
    private providerRepo = AppDataSource.getRepository(Provider);

    /**
     * Generate or update fingerprints for a profile
     * This should be called whenever a profile is created or updated
     */
    async syncProfileFingerprints(profile: HolidayProfile): Promise<void> {
        console.log(`🔒 Syncing fingerprints for profile ${profile.id} (${profile.name})`);

        // 1. Identify enabled providers
        let providerCodes: string[] = [];
        if (profile.enabledProviders && profile.enabledProviders.length > 0) {
            providerCodes = profile.enabledProviders.map(p => p.toLowerCase());
        } else {
            // Default to all known adapters if none specified? Or none?
            // Let's default to all enabled adapters for now if empty (or maybe empty means none)
            // But usually UI sends explicitly. Let's assume empty means NONE to be safe,
            // unless we want a default.
            // Actually, let's treat explicit empty array as "None".
        }

        if (providerCodes.length === 0) {
            console.log('   No providers enabled for this profile. Disabling all fingerprints.');
            await this.disableAllForProfile(profile.id);
            return;
        }

        // 2. Resolve Providers from DB
        const providers = await this.providerRepo.createQueryBuilder('p')
            .where('LOWER(p.code) IN (:...codes)', { codes: providerCodes })
            .getMany();

        if (providers.length === 0) {
            console.warn('   No matching provider entities found in DB for codes:', providerCodes);
            return;
        }

        // 3. For each provider, generate canonical fingerprint
        for (const provider of providers) {
            await this.ensureFingerprint(profile, provider);
        }

        // 4. Disable fingerprints for providers no longer in the list
        const activeProviderIds = providers.map(p => p.id);
        await this.disableOrphanedFingerprints(profile.id, activeProviderIds);
    }

    private async ensureFingerprint(profile: HolidayProfile, provider: Provider): Promise<void> {
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
            }
        });

        if (fingerprint) {
            // Already exists, ensure it's enabled
            if (!fingerprint.enabled) {
                fingerprint.enabled = true;
                await this.fingerprintRepo.save(fingerprint);
                console.log(`   Re-enabled existing fingerprint ${fingerprint.id.slice(0, 8)}`);
            }
        } else {
            // Create new
            fingerprint = this.fingerprintRepo.create({
                profile,
                provider,
                canonicalHash,
                canonicalJson,
                enabled: true,
                checkFrequencyHours: 48 // Default, could be tuned via profile
            });
            await this.fingerprintRepo.save(fingerprint);
            console.log(`   Created new fingerprint ${fingerprint.id.slice(0, 8)} for ${provider.code}`);
        }
    }

    private async disableAllForProfile(profileId: string): Promise<void> {
        await this.fingerprintRepo.update(
            { profile: { id: profileId } },
            { enabled: false }
        );
    }

    private async disableOrphanedFingerprints(profileId: string, activeProviderIds: string[]): Promise<void> {
        // Disable fingerprints for this profile where provider NOT in active list
        // TypeORM doesn't support NOT IN easily in update, so specific query or iteration
        const orphans = await this.fingerprintRepo.createQueryBuilder('f')
            .where('f.profile_id = :profileId', { profileId })
            .andWhere('f.provider_id NOT IN (:...pIds)', { pIds: activeProviderIds })
            .andWhere('f.enabled = :enabled', { enabled: true })
            .getMany();

        if (orphans.length > 0) {
            for (const orphan of orphans) {
                orphan.enabled = false;
                await this.fingerprintRepo.save(orphan);
            }
            console.log(`   Disabled ${orphans.length} orphaned fingerprints`);
        }
    }
}

export const fingerprintService = new FingerprintService();
