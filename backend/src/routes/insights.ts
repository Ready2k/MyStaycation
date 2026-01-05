import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { Insight } from '../entities/Insight';
import { Alert, AlertStatus } from '../entities/Alert';
import { PriceObservation } from '../entities/PriceObservation';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { authenticate } from '../middleware/auth';

const insightRepo = AppDataSource.getRepository(Insight);
const alertRepo = AppDataSource.getRepository(Alert);
const observationRepo = AppDataSource.getRepository(PriceObservation);
const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);

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
        const userId = (request as any).user.userId;
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

    // Get price history for a fingerprint (for charts)
    fastify.get('/insights/:fingerprintId/price-history', {
        preHandler: [authenticate],
        schema: {
            params: {
                type: 'object',
                properties: {
                    fingerprintId: { type: 'string' },
                },
                required: ['fingerprintId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    days: { type: 'number', default: 90 }, // Default to 90 days
                },
            },
        },
    }, async (request, reply) => {
        const userId = (request as any).user.userId;
        const { fingerprintId } = request.params as any;
        const { days = 90 } = request.query as any;

        // Verify fingerprint belongs to user
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['profile'],
        });

        if (!fingerprint || fingerprint.profile.user.id !== userId) {
            return reply.code(404).send({ error: 'Fingerprint not found' });
        }

        // Calculate date cutoff
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Fetch observations grouped by series key
        const observations = await observationRepo
            .createQueryBuilder('obs')
            .where('obs.fingerprint_id = :fingerprintId', { fingerprintId })
            .andWhere('obs.observedAt >= :cutoffDate', { cutoffDate })
            .orderBy('obs.seriesKey', 'ASC')
            .addOrderBy('obs.observedAt', 'ASC')
            .getMany();

        // Group by series key
        const seriesMap = new Map<string, any>();

        for (const obs of observations) {
            if (!seriesMap.has(obs.seriesKey)) {
                seriesMap.set(obs.seriesKey, {
                    seriesKey: obs.seriesKey,
                    stayStartDate: obs.stayStartDate,
                    stayNights: obs.stayNights,
                    data: [],
                });
            }

            seriesMap.get(obs.seriesKey)!.data.push({
                date: obs.observedAt,
                price: parseFloat(obs.priceTotalGbp.toString()),
                availability: obs.availability,
            });
        }

        const series = Array.from(seriesMap.values());

        return {
            fingerprintId,
            days,
            series,
            totalObservations: observations.length,
        };
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
        const userId = (request as any).user.userId;
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
        const userId = (request as any).user.userId;
        const { id } = request.params as any;

        const alert = await alertRepo.findOne({
            where: { id, user: { id: userId } },
        });

        if (!alert) {
            return reply.code(404).send({ error: 'Alert not found' });
        }

        alert.status = AlertStatus.DISMISSED;
        await alertRepo.save(alert);

        return { success: true };
    });
}
