import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile } from '../entities/HolidayProfile';
import { searchService } from '../services/search/SearchService';

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
}
