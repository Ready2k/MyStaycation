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

    // POST /search/:profileId/run - Trigger an immediate search with fingerprint creation
    fastify.post<{ Params: { profileId: string } }>('/search/:profileId/run', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { profileId } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id: profileId, user: { id: user.userId } },
                relations: ['provider'] // Load provider relation for fingerprint sync
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            // Run preview search for immediate results to show user
            const { previewService } = await import('../services/search/preview.service');
            const previewResults = await previewService.executePreview({
                mode: 'PROFILE_ID',
                profileId: profile.id,
                userId: user.userId,
                options: {
                    includeDebug: false,
                    includeMismatches: false,
                }
            });

            // Also sync fingerprints and queue monitoring jobs for persistent data collection
            try {
                const { fingerprintService } = await import('../services/search/fingerprint.service');
                await fingerprintService.syncProfileFingerprints(profile);

                // Get the created fingerprints
                const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
                const fingerprints = await fingerprintRepo.find({
                    where: { profile: { id: profile.id }, enabled: true },
                    relations: ['provider']
                });

                // Queue monitoring jobs
                if (fingerprints.length > 0) {
                    const { addMonitorJob } = await import('../jobs/queues');
                    for (const fingerprint of fingerprints) {
                        await addMonitorJob({
                            fingerprintId: fingerprint.id,
                            providerId: fingerprint.provider.id,
                            searchParams: typeof fingerprint.canonicalJson === 'string'
                                ? JSON.parse(fingerprint.canonicalJson)
                                : fingerprint.canonicalJson,
                        });
                    }
                    request.log.info(`Queued ${fingerprints.length} monitoring jobs for profile ${profileId}`);
                }
            } catch (err) {
                request.log.error({ err }, 'Failed to queue monitoring jobs');
                // Don't fail the request, user still gets preview results
            }

            // Return preview results in the same format as before
            const flattenedResults: any[] = [];
            previewResults.providers.forEach((provider: any) => {
                const addResults = (items: any[]) => {
                    items.forEach(item => {
                        flattenedResults.push({
                            providerKey: item.providerKey,
                            location: item.location || item.parkId || 'Unknown Location',
                            propertyName: item.propertyName || item.accommodationType || 'Accommodation',
                            price: item.price,
                            stayNights: item.stayNights,
                            stayStartDate: item.stayStartDate,
                            sourceUrl: item.sourceUrl,
                            confidence: item.confidence,
                            reasons: item.reasons
                        });
                    });
                };

                if (provider.results?.matched) addResults(provider.results.matched);
                if (provider.results?.other) addResults(provider.results.other);
            });

            console.log(`DEBUG: Returning ${flattenedResults.length} results to frontend`);
            if (flattenedResults.length > 0) {
                console.log(`DEBUG: First result: ${JSON.stringify(flattenedResults[0])}`);
            }

            return reply.send({
                message: 'Search completed',
                count: flattenedResults.length,
                results: flattenedResults
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
                userId: user.userId
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

        request.log.info(`GET /search/fingerprints for user ${user.userId}, profile ${profileId}`);

        try {
            const fingerprintRepo = AppDataSource.getRepository('SearchFingerprint');

            // Use find() for safer relation filtering
            const whereClause: any = {
                profile: {
                    user: { id: user.userId }
                }
            };

            if (profileId) {
                whereClause.profile.id = profileId;
            }

            const fingerprints = await fingerprintRepo.find({
                where: whereClause,
                relations: ['profile', 'provider']
            });

            request.log.info(`Found ${fingerprints.length} fingerprints for user ${user.userId}`);

            // Debug: Check if we found any if profileId was provided
            if (profileId && fingerprints.length === 0) {
                // Double check if profile exists at all for this user
                const profileRepo = AppDataSource.getRepository(HolidayProfile);
                const profile = await profileRepo.findOne({
                    where: { id: profileId, user: { id: user.userId } }
                });
                request.log.info(`Debug: Profile ${profileId} exists for user? ${!!profile}`);
            }

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
