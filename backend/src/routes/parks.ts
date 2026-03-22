import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { ProviderPark } from '../entities/ProviderPark';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const querySchema = z.object({
    provider: z.string().optional(),
    region: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export async function parksRoutes(fastify: FastifyInstance) {
    const parkRepo = AppDataSource.getRepository(ProviderPark);

    fastify.get('/parks', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const query = querySchema.safeParse(request.query);
        if (!query.success) {
            return reply.status(400).send({ error: 'Invalid query parameters' });
        }

        const { provider, region, limit } = query.data;

        const qb = parkRepo.createQueryBuilder('park')
            .leftJoinAndSelect('park.provider', 'provider')
            .where('provider.enabled = true')
            .orderBy('provider.name', 'ASC')
            .addOrderBy('park.name', 'ASC')
            .take(limit);

        if (provider) {
            qb.andWhere('LOWER(provider.code) = LOWER(:provider)', { provider });
        }

        if (region) {
            qb.andWhere('LOWER(park.region) = LOWER(:region)', { region });
        }

        const [parks, total] = await qb.getManyAndCount();

        const result = parks.map(p => ({
            id: p.id,
            name: p.name,
            providerCode: p.provider.code,
            providerName: p.provider.name,
            region: p.region ?? null,
            latitude: p.latitude ? parseFloat(String(p.latitude)) : null,
            longitude: p.longitude ? parseFloat(String(p.longitude)) : null,
            parkCode: p.providerParkCode ?? null,
        }));

        // Collect distinct regions for filter UI
        const regions = await AppDataSource.query<{ region: string }[]>(
            `SELECT DISTINCT park.region
             FROM provider_parks park
             JOIN providers prov ON prov.id = park.provider_id
             WHERE prov.enabled = true
               AND park.region IS NOT NULL
             ORDER BY park.region`
        );

        return reply.send({
            parks: result,
            total,
            regions: regions.map(r => r.region),
        });
    });
}
