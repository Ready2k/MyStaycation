import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { Insight } from '../entities/Insight';
import { Alert } from '../entities/Alert';
import { authenticate } from '../middleware/auth';

const insightRepo = AppDataSource.getRepository(Insight);
const alertRepo = AppDataSource.getRepository(Alert);

export async function insightsRoutes(fastify: FastifyInstance) {
    // Get recent insights for user's profiles
    fastify.get('/insights/recent', {
        preHandler: [authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 10 },
                },
            },
        },
    }, async (request, reply) => {
        const userId = (request as any).user.id;
        const { limit = 10 } = request.query as any;

        // Get insights for user's fingerprints
        const insights = await insightRepo
            .createQueryBuilder('insight')
            .leftJoinAndSelect('insight.fingerprint', 'fingerprint')
            .leftJoinAndSelect('fingerprint.profile', 'profile')
            .where('profile.userId = :userId', { userId })
            .orderBy('insight.createdAt', 'DESC')
            .limit(limit)
            .getMany();

        return { insights, total: insights.length };
    });

    // Get recent alerts
    fastify.get('/alerts/recent', {
        preHandler: [authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 10 },
                    unreadOnly: { type: 'boolean', default: false },
                },
            },
        },
    }, async (request, reply) => {
        const userId = (request as any).user.id;
        const { limit = 10, unreadOnly = false } = request.query as any;

        const queryBuilder = alertRepo
            .createQueryBuilder('alert')
            .leftJoinAndSelect('alert.insight', 'insight')
            .leftJoinAndSelect('insight.fingerprint', 'fingerprint')
            .leftJoinAndSelect('fingerprint.profile', 'profile')
            .where('alert.user_id = :userId', { userId });

        if (unreadOnly) {
            queryBuilder.andWhere('alert.status != :status', { status: 'DISMISSED' });
        }

        const alerts = await queryBuilder
            .orderBy('alert.createdAt', 'DESC')
            .limit(limit)
            .getMany();

        const totalUnread = await alertRepo
            .createQueryBuilder('alert')
            .where('alert.user_id = :userId', { userId })
            .andWhere('alert.status != :status', { status: 'DISMISSED' })
            .getCount();

        return { alerts, totalUnread };
    });

    // Mark alert as dismissed
    fastify.patch('/alerts/:id/dismiss', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = (request as any).user.id;
        const { id } = request.params as any;

        const alert = await alertRepo.findOne({
            where: { id, user: { id: userId } },
        });

        if (!alert) {
            return reply.code(404).send({ error: 'Alert not found' });
        }

        alert.status = 'DISMISSED';
        await alertRepo.save(alert);

        return { success: true };
    });
}
