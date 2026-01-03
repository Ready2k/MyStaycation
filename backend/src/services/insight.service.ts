import { AppDataSource } from '../config/database';
import { PriceObservation } from '../entities/PriceObservation';
import { Insight, InsightType } from '../entities/Insight';
import { generateInsightDedupeKey } from '../utils/series-key';

const observationRepo = AppDataSource.getRepository(PriceObservation);
const insightRepo = AppDataSource.getRepository(Insight);

export class InsightService {
    /**
     * Generate insights for a specific fingerprint
     * Uses series-based analysis to ensure like-for-like comparisons
     */
    async generateInsights(fingerprintId: string): Promise<Insight[]> {
        const insights: Insight[] = [];

        // Step 1: Get all distinct series keys for this fingerprint
        const seriesKeysResult = await observationRepo
            .createQueryBuilder('obs')
            .select('DISTINCT obs.seriesKey', 'seriesKey')
            .where('obs.fingerprint_id = :fingerprintId', { fingerprintId })
            .getRawMany();

        console.log(`Found ${seriesKeysResult.length} distinct series for fingerprint ${fingerprintId}`);

        // Step 2: For each series, run insight analysis
        for (const { seriesKey } of seriesKeysResult) {
            const seriesInsights = await this.analyzeSeriesInsights(fingerprintId, seriesKey);
            insights.push(...seriesInsights);
        }

        return insights;
    }

    /**
     * Analyze a single series for insights
     */
    private async analyzeSeriesInsights(fingerprintId: string, seriesKey: string): Promise<Insight[]> {
        const insights: Insight[] = [];

        // Get observations for this series, ordered by time
        const observations = await observationRepo.find({
            where: {
                fingerprint: { id: fingerprintId },
                seriesKey,
            },
            order: { observedAt: 'DESC' },
        });

        if (observations.length === 0) {
            return insights;
        }

        // Check for lowest price in X days
        const lowestInsight = await this.checkLowestInXDays(fingerprintId, seriesKey, observations);
        if (lowestInsight) insights.push(lowestInsight);

        // Check for price drop
        const dropInsight = await this.checkPriceDrop(fingerprintId, seriesKey, observations);
        if (dropInsight) insights.push(dropInsight);

        // Check for rising risk
        const riskInsight = await this.checkRisingRisk(fingerprintId, seriesKey, observations);
        if (riskInsight) insights.push(riskInsight);

        // Save all insights (with deduplication)
        for (const insight of insights) {
            try {
                await insightRepo.save(insight);
            } catch (error) {
                // Unique constraint violation - insight already exists
                console.log(`Insight already exists for dedupe key: ${insight.dedupeKey}`);
            }
        }

        return insights;
    }

    /**
     * Check if current price is lowest in X days (within same series)
     */
    private async checkLowestInXDays(
        fingerprintId: string,
        seriesKey: string,
        observations: PriceObservation[]
    ): Promise<Insight | null> {
        const windowDays = 180;
        const minObservations = 5;

        // Require minimum observations for confidence
        if (observations.length < minObservations) {
            return null;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - windowDays);

        // Query observations within window for this series
        const windowObservations = await observationRepo.find({
            where: {
                fingerprint: { id: fingerprintId },
                seriesKey,
            },
            order: { observedAt: 'DESC' },
        });

        const recentObs = windowObservations.filter(obs => obs.observedAt >= cutoffDate);

        if (recentObs.length < minObservations) {
            return null;
        }

        const latest = observations[0];
        const minPrice = Math.min(...recentObs.map(obs => Number(obs.priceTotalGbp)));

        if (Number(latest.priceTotalGbp) <= minPrice) {
            const dedupeKey = generateInsightDedupeKey({
                fingerprintId,
                seriesKey,
                insightType: InsightType.LOWEST_IN_X_DAYS,
                windowIdentifier: 'LOWEST_180D',
            });

            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.LOWEST_IN_X_DAYS,
                seriesKey,
                dedupeKey,
                summary: `Lowest price in ${windowDays} days: £${latest.priceTotalGbp}`,
                details: {
                    currentPrice: latest.priceTotalGbp,
                    previousMin: minPrice,
                    windowDays,
                    observationCount: recentObs.length,
                    stayStartDate: latest.stayStartDate,
                    stayNights: latest.stayNights,
                    seriesKey,
                },
            });
        }

        return null;
    }

    /**
     * Check for meaningful price drop (within same series)
     */
    private async checkPriceDrop(
        fingerprintId: string,
        seriesKey: string,
        observations: PriceObservation[]
    ): Promise<Insight | null> {
        if (observations.length < 2) {
            return null;
        }

        const latest = observations[0];
        const previous = observations[1];

        const priceDiff = Number(previous.priceTotalGbp) - Number(latest.priceTotalGbp);
        const percentDrop = (priceDiff / Number(previous.priceTotalGbp)) * 100;

        // Threshold: drop >= max(£75, 7%)
        const minAbsoluteDrop = 75;
        const minPercentDrop = 7;

        if (priceDiff >= minAbsoluteDrop || percentDrop >= minPercentDrop) {
            const dedupeKey = generateInsightDedupeKey({
                fingerprintId,
                seriesKey,
                insightType: InsightType.PRICE_DROP_PERCENT,
                windowIdentifier: 'PRICE_DROP',
            });

            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.PRICE_DROP_PERCENT,
                seriesKey,
                dedupeKey,
                summary: `Price dropped by £${priceDiff.toFixed(2)} (${percentDrop.toFixed(1)}%)`,
                details: {
                    currentPrice: latest.priceTotalGbp,
                    previousPrice: previous.priceTotalGbp,
                    absoluteDrop: priceDiff,
                    percentDrop,
                    stayStartDate: latest.stayStartDate,
                    stayNights: latest.stayNights,
                    seriesKey,
                },
            });
        }

        return null;
    }

    /**
     * Check for rising booking risk (within same series)
     */
    private async checkRisingRisk(
        fingerprintId: string,
        seriesKey: string,
        observations: PriceObservation[]
    ): Promise<Insight | null> {
        const minObservations = 5;

        if (observations.length < minObservations) {
            return null;
        }

        const recent = observations.slice(0, minObservations);
        const soldOutCount = recent.filter(obs => obs.availability === 'SOLD_OUT').length;

        // Check if prices are trending up within this series
        const prices = recent.map(obs => Number(obs.priceTotalGbp));
        const avgRecentPrice = prices.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        const avgOlderPrice = prices.slice(3, 5).reduce((a, b) => a + b, 0) / 2;

        const priceIncrease = avgRecentPrice > avgOlderPrice;

        if (soldOutCount >= 2 && priceIncrease) {
            const dedupeKey = generateInsightDedupeKey({
                fingerprintId,
                seriesKey,
                insightType: InsightType.RISK_RISING,
                windowIdentifier: 'RISK_RISING',
            });

            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.RISK_RISING,
                seriesKey,
                dedupeKey,
                summary: `Booking risk rising: ${soldOutCount} sold out dates, prices increasing`,
                details: {
                    soldOutCount,
                    totalChecked: recent.length,
                    avgRecentPrice,
                    avgOlderPrice,
                    priceIncrease: avgRecentPrice - avgOlderPrice,
                    seriesKey,
                },
            });
        }

        return null;
    }

    /**
     * Get all insights for a fingerprint
     */
    async getInsights(fingerprintId: string, limit: number = 20): Promise<Insight[]> {
        return insightRepo.find({
            where: { fingerprint: { id: fingerprintId } },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
}

export const insightService = new InsightService();
