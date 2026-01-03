import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile } from '../entities/HolidayProfile';
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
            // Note: complex validation best done with Zod
            const previewSchema = z.object({
                mode: z.enum(['PROFILE_ID', 'INLINE_PROFILE']),
                profileId: z.string().uuid().optional(),
                profile: createProfileSchema.partial().optional(), // Use shared schema
                providers: z.array(z.string()).optional(),
                options: z.object({
                    maxResults: z.number().int().optional(),
                    enrichTopN: z.number().int().optional(),
                    allowWeakMatches: z.boolean().optional(),
                    includeMismatches: z.boolean().optional(),
                    dryRun: z.boolean().optional()
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

            // Execute service
            const response = await previewService.executePreview({
                mode: validated.mode as any,
                profileId: validated.profileId,
                profile: validated.profile as any,
                providers: validated.providers,
                options: validated.options
            });

            return reply.send(response);

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            // Handle service errors
            if (error instanceof Error && error.message.includes('Profile not found')) {
                return reply.code(404).send({ message: error.message });
            }
            return reply.code(500).send({ message: 'Preview failed', error: error instanceof Error ? error.message : 'Unknown' });
        }
    });

}
