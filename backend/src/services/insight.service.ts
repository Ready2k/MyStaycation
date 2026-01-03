import { AppDataSource } from '../config/database';
import { PriceObservation } from '../entities/PriceObservation';
import { Insight, InsightType } from '../entities/Insight';

const observationRepo = AppDataSource.getRepository(PriceObservation);
const insightRepo = AppDataSource.getRepository(Insight);

export class InsightService {
    /**
     * Generate insights for a specific fingerprint
     */
    async generateInsights(fingerprintId: string): Promise<Insight[]> {
        const insights: Insight[] = [];

        // Get recent observations
        const observations = await observationRepo.find({
            where: { fingerprint: { id: fingerprintId } },
            order: { observedAt: 'DESC' },
            take: 100,
        });

        if (observations.length === 0) {
            return insights;
        }

        // Check for lowest price in X days
        const lowestInsight = await this.checkLowestInXDays(fingerprintId, observations);
        if (lowestInsight) insights.push(lowestInsight);

        // Check for price drop
        const dropInsight = await this.checkPriceDrop(fingerprintId, observations);
        if (dropInsight) insights.push(dropInsight);

        // Check for rising risk
        const riskInsight = await this.checkRisingRisk(fingerprintId, observations);
        if (riskInsight) insights.push(riskInsight);

        // Save all insights
        for (const insight of insights) {
            await insightRepo.save(insight);
        }

        return insights;
    }

    /**
     * Check if current price is lowest in X days
     */
    private async checkLowestInXDays(
        fingerprintId: string,
        observations: PriceObservation[]
    ): Promise<Insight | null> {
        const windowDays = 180;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - windowDays);

        const latest = observations[0];
        const historicalObservations = observations.filter(
            obs => obs.observedAt >= cutoffDate
        );

        if (historicalObservations.length < 5) {
            return null; // Not enough data
        }

        const minPrice = Math.min(...historicalObservations.map(obs => Number(obs.priceTotalGbp)));

        if (Number(latest.priceTotalGbp) <= minPrice) {
            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.LOWEST_IN_X_DAYS,
                summary: `Lowest price in ${windowDays} days: £${latest.priceTotalGbp}`,
                details: {
                    currentPrice: latest.priceTotalGbp,
                    previousMin: minPrice,
                    windowDays,
                    observationCount: historicalObservations.length,
                    stayStartDate: latest.stayStartDate,
                    stayNights: latest.stayNights,
                },
            });
        }

        return null;
    }

    /**
     * Check for meaningful price drop
     */
    private async checkPriceDrop(
        fingerprintId: string,
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
            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.PRICE_DROP_PERCENT,
                summary: `Price dropped by £${priceDiff.toFixed(2)} (${percentDrop.toFixed(1)}%)`,
                details: {
                    currentPrice: latest.priceTotalGbp,
                    previousPrice: previous.priceTotalGbp,
                    absoluteDrop: priceDiff,
                    percentDrop,
                    stayStartDate: latest.stayStartDate,
                    stayNights: latest.stayNights,
                },
            });
        }

        return null;
    }

    /**
     * Check for rising booking risk (availability shrinking + prices rising)
     */
    private async checkRisingRisk(
        fingerprintId: string,
        observations: PriceObservation[]
    ): Promise<Insight | null> {
        if (observations.length < 5) {
            return null;
        }

        const recent = observations.slice(0, 5);
        const soldOutCount = recent.filter(obs => obs.availability === 'SOLD_OUT').length;

        // Check if prices are trending up
        const prices = recent.map(obs => Number(obs.priceTotalGbp));
        const avgRecentPrice = prices.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        const avgOlderPrice = prices.slice(3, 5).reduce((a, b) => a + b, 0) / 2;

        const priceIncrease = avgRecentPrice > avgOlderPrice;

        if (soldOutCount >= 2 && priceIncrease) {
            return insightRepo.create({
                fingerprint: { id: fingerprintId },
                type: InsightType.RISK_RISING,
                summary: `Booking risk rising: ${soldOutCount} sold out dates, prices increasing`,
                details: {
                    soldOutCount,
                    totalChecked: recent.length,
                    avgRecentPrice,
                    avgOlderPrice,
                    priceIncrease: avgRecentPrice - avgOlderPrice,
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
