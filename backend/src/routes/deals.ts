import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { Deal } from '../entities/Deal';
import { authenticate } from '../middleware/auth';

export async function dealRoutes(fastify: FastifyInstance) {
    fastify.get('/deals', {
        preHandler: [authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    provider: { type: 'string' },
                    activeOnly: { type: 'boolean', default: true },
                    limit: { type: 'number', default: 50 },
                    page: { type: 'number', default: 1 },
                },
            },
        },
    }, async (request, _reply) => {
        const { provider, activeOnly = true, limit = 50, page = 1 } = request.query as {
            provider?: string;
            activeOnly?: boolean;
            limit?: number;
            page?: number;
        };

        const dealRepo = AppDataSource.getRepository(Deal);

        const queryBuilder = dealRepo
            .createQueryBuilder('deal')
            .leftJoinAndSelect('deal.provider', 'provider')
            .orderBy('deal.lastSeenAt', 'DESC');

        if (provider) {
            queryBuilder.andWhere('provider.code = :provider', { provider });
        }

        if (activeOnly) {
            const now = new Date();
            queryBuilder.andWhere('(deal.endsAt IS NULL OR deal.endsAt > :now)', { now });
        }

        const offset = (page - 1) * limit;
        const [deals, total] = await queryBuilder
            .skip(offset)
            .take(limit)
            .getManyAndCount();

        return {
            deals,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    });
}
