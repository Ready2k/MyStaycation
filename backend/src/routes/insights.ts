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
    }, async (request, _reply) => {
        const userId = (request.user as { userId: string }).userId;
        const { limit = 10 } = request.query as Record<string, unknown>;

        // Get insights for user's fingerprints
        const insights = await insightRepo
            .createQueryBuilder('insight')
            .leftJoinAndSelect('insight.fingerprint', 'fingerprint')
            .leftJoinAndSelect('fingerprint.profile', 'profile')
            .where('profile.user = :userId', { userId })
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
        const userId = (request.user as { userId: string }).userId;
        const { fingerprintId } = request.params as { id?: string; fingerprintId?: string };
        const { days = 90 } = request.query as Record<string, unknown>;

        // Verify fingerprint belongs to user and get profile data
        const fingerprint = await fingerprintRepo.findOne({
            where: { id: fingerprintId },
            relations: ['profile', 'profile.user', 'park'],
        });

        if (!fingerprint || !fingerprint.profile.user || fingerprint.profile.user.id !== userId) {
            return reply.code(404).send({ error: 'Fingerprint not found' });
        }

        // Calculate date cutoff
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Fetch observations with park and accomType metadata
        const observations = await observationRepo
            .createQueryBuilder('obs')
            .leftJoinAndSelect('obs.accomType', 'accomType')
            .leftJoinAndSelect('obs.park', 'observationPark')
            .leftJoinAndSelect('obs.fingerprint', 'fingerprint')
            .leftJoinAndSelect('fingerprint.park', 'park')
            .where('obs.fingerprint_id = :fingerprintId', { fingerprintId })
            .andWhere('obs.observedAt >= :cutoffDate', { cutoffDate })
            .orderBy('obs.seriesKey', 'ASC')
            .addOrderBy('obs.observedAt', 'ASC')
            .getMany();

        // Group by series key and calculate statistics
        const seriesMap = new Map<string, any>();

        for (const obs of observations) {
            if (!seriesMap.has(obs.seriesKey)) {
                seriesMap.set(obs.seriesKey, {
                    seriesKey: obs.seriesKey,
                    stayStartDate: obs.stayStartDate,
                    stayNights: obs.stayNights,
                    accomName: obs.accomType?.name || undefined,
                    accomTypeId: obs.accomType?.id || undefined,
                    parkName: obs.park?.name || undefined,
                    parkRegion: obs.park?.region || undefined,
                    data: [],
                    prices: [], // For statistics calculation
                });
            }

            const price = parseFloat(obs.priceTotalGbp.toString());
            seriesMap.get(obs.seriesKey)!.data.push({
                date: obs.observedAt,
                price,
                pricePerNight: parseFloat(obs.pricePerNightGbp.toString()),
                availability: obs.availability,
                sourceUrl: obs.sourceUrl || undefined,
            });
            seriesMap.get(obs.seriesKey)!.prices.push(price);
        }

        // Calculate statistics for each series
        const series = Array.from(seriesMap.values()).map(s => {
            const prices = s.prices;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;

            // Calculate price trend (% change from first to latest observation)
            const firstPrice = prices[0];
            const lastPrice = prices[prices.length - 1];
            const priceChangePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

            // Remove temporary prices array
            delete s.prices;

            return {
                ...s,
                statistics: {
                    minPrice: Math.round(minPrice * 100) / 100,
                    maxPrice: Math.round(maxPrice * 100) / 100,
                    avgPrice: Math.round(avgPrice * 100) / 100,
                    currentPrice: lastPrice,
                    priceChangePercent: Math.round(priceChangePercent * 100) / 100,
                    dataPoints: prices.length,
                },
            };
        });

        // Get facilities from the profile
        const facilities = fingerprint.profile.requiredFacilities || [];

        return {
            fingerprintId,
            days,
            series,
            totalObservations: observations.length,
            metadata: {
                profileName: fingerprint.profile.name,
                region: fingerprint.profile.region || undefined,
                facilities,
                pets: fingerprint.profile.pets,
                accommodationType: fingerprint.profile.accommodationType,
            },
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
    }, async (request, _reply) => {
        const userId = (request.user as { userId: string }).userId;
        const { limit = 10, unreadOnly = false } = request.query as Record<string, unknown>;

        const queryBuilder = alertRepo
            .createQueryBuilder('alert')
            .leftJoinAndSelect('alert.insight', 'insight')
            .leftJoinAndSelect('insight.fingerprint', 'fingerprint')
            .leftJoinAndSelect('fingerprint.profile', 'profile')
            .where('alert.user = :userId', { userId });

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
        const userId = (request.user as { userId: string }).userId;
        const { id } = request.params as { id?: string; fingerprintId?: string };

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
