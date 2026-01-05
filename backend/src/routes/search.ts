import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile } from '../entities/HolidayProfile';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { searchService } from '../services/search/SearchService';
import { previewService } from '../services/search/preview.service';
import z from 'zod';
import { createProfileSchema } from './profiles';

export async function searchRoutes(fastify: FastifyInstance) {
    const profileRepo = AppDataSource.getRepository(HolidayProfile);

    // POST /search/:profileId/run - Trigger an immediate search
    fastify.post<{ Params: { profileId: string } }>('/search/:profileId/run', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { profileId } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id: profileId, user: { id: user.id } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            // In a real app, we might queue this as a background job
            // For MVP/Demo, we run it inline
            const results = await searchService.searchForProfile(profile);

            return reply.send({
                message: 'Search completed',
                count: results.length,
                results
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Search failed' });
        }
    });
    // POST /search/preview - Real-time search preview
    fastify.post('/search/preview', {
        onRequest: [fastify.authenticate],
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '10 minute'
            }
        }
    }, async (request, reply) => {
        const user = request.user as any;

        try {
            // Parse common envelope
            const previewSchema = z.object({
                mode: z.enum(['PROFILE_ID', 'INLINE_PROFILE']),
                profileId: z.string().uuid().optional(),
                profile: createProfileSchema.partial().optional(),
                providers: z.array(z.string()).optional(),
                options: z.object({
                    maxResults: z.number().int().optional(),
                    enrichTopN: z.number().int().optional(),
                    allowWeakMatches: z.boolean().optional(),
                    includeMismatches: z.boolean().optional(),
                    includeDebug: z.boolean().optional(),
                    forcePlaywright: z.boolean().optional(),
                    includeRaw: z.boolean().optional().default(false)
                }).optional()
            }).refine(data => {
                if (data.mode === 'PROFILE_ID' && !data.profileId) return false;
                if (data.mode === 'INLINE_PROFILE' && !data.profile) return false;
                return true;
            }, {
                message: "profileId required for PROFILE_ID mode, profile object required for INLINE_PROFILE mode",
                path: ["mode"]
            });

            const validated = previewSchema.parse(request.body);

            // Execute service with userId
            const response = await previewService.executePreview({
                mode: validated.mode as any,
                profileId: validated.profileId,
                profile: validated.profile as any,
                providers: validated.providers,
                options: validated.options,
                userId: user.id
            });

            return reply.send(response);

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    message: 'Validation Error',
                    errors: error.errors,
                    sideEffects: {
                        observationsStored: false,
                        alertsGenerated: false,
                        emailsSent: false
                    }
                });
            }
            request.log.error(error);

            // Handle PROFILE_INCOMPLETE errors
            if (error instanceof Error && error.message.includes('PROFILE_INCOMPLETE')) {
                return reply.code(400).send({
                    message: error.message,
                    sideEffects: {
                        observationsStored: false,
                        alertsGenerated: false,
                        emailsSent: false
                    }
                });
            }

            // Handle access denied errors
            if (error instanceof Error && error.message.includes('access denied')) {
                return reply.code(403).send({
                    message: 'Access denied',
                    sideEffects: {
                        observationsStored: false,
                        alertsGenerated: false,
                        emailsSent: false
                    }
                });
            }

            // Handle service errors
            if (error instanceof Error && error.message.includes('Profile not found')) {
                return reply.code(404).send({
                    message: error.message,
                    sideEffects: {
                        observationsStored: false,
                        alertsGenerated: false,
                        emailsSent: false
                    }
                });
            }

            return reply.code(500).send({
                message: 'Preview failed',
                error: error instanceof Error ? error.message : 'Unknown',
                sideEffects: {
                    observationsStored: false,
                    alertsGenerated: false,
                    emailsSent: false
                }
            });
        }
    });

    // GET /search/fingerprints - Get fingerprints for a profile
    fastify.get('/search/fingerprints', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { profileId } = request.query as any;

        try {
            const fingerprintRepo = AppDataSource.getRepository('SearchFingerprint');

            const query = fingerprintRepo
                .createQueryBuilder('f')
                .leftJoinAndSelect('f.profile', 'profile')
                .leftJoinAndSelect('f.provider', 'provider')
                .where('profile.user_id = :userId', { userId: user.id });

            if (profileId) {
                query.andWhere('profile.id = :profileId', { profileId });
            }

            const fingerprints = await query.getMany();

            return reply.send({ fingerprints });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to fetch fingerprints' });
        }
    });

    // GET /providers - Get available providers
    fastify.get('/providers', async (request, reply) => {
        try {
            const { adapterRegistry } = await import('../adapters/registry');
            const providers = adapterRegistry.getProviderMetadata();
            return reply.send({ providers });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to fetch providers' });
        }
    });

}
