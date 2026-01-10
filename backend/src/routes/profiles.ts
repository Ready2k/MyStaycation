import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile, FlexType, PeakTolerance, AccommodationType, AccommodationTier, StayPattern, SchoolHolidayMatch, AlertSensitivity } from '../entities/HolidayProfile';
import { User } from '../entities/User';
import { Provider } from '../entities/Provider';
import z from 'zod';

// Validation schemas
export const createProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    providerCode: z.string().optional(), // NEW: Provider-specific watcher
    partySizeAdults: z.number().int().min(1).default(2),
    partySizeChildren: z.number().int().min(0).default(0),
    flexType: z.nativeEnum(FlexType).default(FlexType.RANGE),
    dateStart: z.string().optional().transform(str => str ? new Date(str) : undefined),
    dateEnd: z.string().optional().transform(str => str ? new Date(str) : undefined),
    durationNightsMin: z.number().int().min(1).default(3),
    durationNightsMax: z.number().int().min(1).default(7),
    peakTolerance: z.nativeEnum(PeakTolerance).default(PeakTolerance.MIXED),
    budgetCeilingGbp: z.number().nullable().optional().transform(val => val === null ? undefined : val),
    enabled: z.boolean().default(true),
    pets: z.boolean().default(false),
    // New Fields
    accommodationType: z.nativeEnum(AccommodationType).default(AccommodationType.ANY),
    minBedrooms: z.number().int().min(0).default(0),
    tier: z.nativeEnum(AccommodationTier).default(AccommodationTier.STANDARD),
    stayPattern: z.nativeEnum(StayPattern).default(StayPattern.ANY),
    schoolHolidays: z.nativeEnum(SchoolHolidayMatch).default(SchoolHolidayMatch.ALLOW),
    petsNumber: z.number().int().min(0).default(0),
    stepFreeAccess: z.boolean().default(false),
    accessibleBathroom: z.boolean().default(false),
    requiredFacilities: z.array(z.string()).default([]),
    alertSensitivity: z.nativeEnum(AlertSensitivity).default(AlertSensitivity.INSTANT),

    // Metadata & Advanced Search
    region: z.string().nullable().optional().transform(val => val === null || val === '' ? undefined : val),
    maxResults: z.number().int().min(1).max(100).default(50),
    sortOrder: z.enum(['PRICE_ASC', 'PRICE_DESC', 'DATE_ASC']).default('PRICE_ASC'),
    enabledProviders: z.array(z.string()).default([]),
    parkIds: z.union([
        z.array(z.string()),
        z.string().transform(str => str ? str.split(',').map(s => s.trim()) : []),
        z.null().transform(() => []),
        z.undefined().transform(() => [])
    ]).optional().default([]),
    metadata: z.any().optional() // Provider-specific metadata (lodges, filters, etc.)
});

const updateProfileSchema = createProfileSchema.partial();

export async function profileRoutes(fastify: FastifyInstance) {
    const profileRepo = AppDataSource.getRepository(HolidayProfile);

    // GET /profiles - List all profiles for the current user
    fastify.get('/profiles', {
        onRequest: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;

        try {
            const profiles = await profileRepo.find({
                where: { user: { id: user.userId } },
                relations: ['provider'], // Load provider relation for edit routing
                order: { createdAt: 'DESC' }
            });
            return profiles;
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Internal Server Error' });
        }
    });

    // POST /profiles - Create a new profile
    fastify.post('/profiles', {
        onRequest: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any; // JWT user payload

        try {
            const validatedData = createProfileSchema.parse(request.body);
            const { providerCode, ...profileData } = validatedData;

            // Lookup provider if providerCode is provided
            let provider = null;
            if (providerCode) {
                const providerRepo = AppDataSource.getRepository(Provider);
                provider = await providerRepo.findOne({ where: { code: providerCode } });
                if (!provider) {
                    return reply.code(400).send({ error: `Provider '${providerCode}' not found` });
                }
            }

            const profile = profileRepo.create({
                ...profileData,
                user: { id: user.userId } as User, // specific user reference
                provider: provider || undefined // Assign provider if found
            });

            await profileRepo.save(profile);

            // Reload profile with provider relation for fingerprint sync
            const savedProfile = await profileRepo.findOne({
                where: { id: profile.id },
                relations: ['provider', 'user']
            });

            if (!savedProfile) {
                throw new Error('Failed to reload saved profile');
            }

            // Sync fingerprints and queue initial monitoring
            try {
                const { fingerprintService } = await import('../services/search/fingerprint.service');
                const fingerprints = await fingerprintService.syncProfileFingerprints(savedProfile);

                // Queue monitoring jobs for immediate execution
                if (fingerprints && fingerprints.length > 0) {
                    const { addMonitorJob } = await import('../jobs/queues');
                    for (const fingerprint of fingerprints) {
                        await addMonitorJob({
                            fingerprintId: fingerprint.id,
                            providerId: fingerprint.provider.id,
                            searchParams: fingerprint.canonicalJson,
                        });
                    }
                    request.log.info(`Queued ${fingerprints.length} initial monitoring jobs for new profile: ${savedProfile.id}`);
                } else {
                    request.log.warn(`No fingerprints created for profile ${savedProfile.id}`);
                }
            } catch (err) {
                request.log.error({ err }, 'Failed to sync fingerprints or queue monitoring jobs');
                // Don't fail the request, just log
            }

            return reply.code(201).send(savedProfile);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to create profile' });
        }
    });

    // GET /profiles/:id - Get a specific profile
    fastify.get<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.userId } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            return profile;
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Internal Server Error' });
        }
    });

    // PUT /profiles/:id - Update a profile
    fastify.put<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.userId } },
                relations: ['provider'] // Load provider relation for fingerprint sync
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            const validatedData = updateProfileSchema.parse(request.body);

            // Merge updates
            profileRepo.merge(profile, validatedData);

            await profileRepo.save(profile);

            // Reload profile with provider relation for fingerprint sync
            const savedProfile = await profileRepo.findOne({
                where: { id: profile.id },
                relations: ['provider', 'user']
            });

            if (!savedProfile) {
                throw new Error('Failed to reload saved profile');
            }

            // Sync fingerprints for the scheduler
            try {
                const { fingerprintService } = await import('../services/search/fingerprint.service');
                await fingerprintService.syncProfileFingerprints(savedProfile);
            } catch (err) {
                request.log.error({ err }, 'Failed to sync fingerprints');
            }

            return savedProfile;
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('Validation Error:', JSON.stringify(error.errors, null, 2));
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to update profile' });
        }
    });

    // DELETE /profiles/:id - Delete a profile
    fastify.delete<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.userId } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            await profileRepo.delete(id);

            return reply.code(204).send();
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to delete profile' });
        }
    });
}
