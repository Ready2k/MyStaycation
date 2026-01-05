import { AppDataSource } from '../config/database';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { addMonitorJob, addDealScanJob } from './queues';
import { Brackets } from 'typeorm';

export class Scheduler {
    private checkInterval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('⏰ Scheduler started (Interval: 1 hour)');

        // Run immediately
        await this.runCheck();

        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.runCheck().catch(err => {
                console.error('❌ Scheduler check failed:', err);
            });
        }, this.CHECK_INTERVAL_MS);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('🔕 Scheduler stopped');
    }

    private async runCheck() {
        try {
            console.log('⏰ Running scheduled check for due monitor jobs...');
            const repo = AppDataSource.getRepository(SearchFingerprint);

            // Find valid fingerprints that are due:
            // 1. Enabled
            // 2. Not scheduled yet OR scheduled strictly before (Now - Frequency)
            const dueFingerprints = await repo.createQueryBuilder('f')
                .leftJoinAndSelect('f.provider', 'p')
                .where('f.enabled = :enabled', { enabled: true })
                .andWhere(new Brackets(qb => {
                    qb.where('f.lastScheduledAt IS NULL')
                        .orWhere("f.lastScheduledAt < NOW() - (f.checkFrequencyHours || ' hours')::interval");
                }))
                .getMany();

            if (dueFingerprints.length === 0) {
                console.log('Hz No monitoring jobs due at this time.');
                return;
            }

            console.log(`⏰ Found ${dueFingerprints.length} fingerprints due for monitoring.`);

            let scheduledCount = 0;
            for (const fingerprint of dueFingerprints) {
                // Double check provider is loaded
                if (!fingerprint.provider) {
                    console.warn(`⚠️ Fingerprint ${fingerprint.id} has no provider, skipping.`);
                    continue;
                }

                await addMonitorJob({
                    fingerprintId: fingerprint.id,
                    providerId: fingerprint.provider.id,
                    searchParams: typeof fingerprint.canonicalJson === 'string'
                        ? JSON.parse(fingerprint.canonicalJson)
                        : fingerprint.canonicalJson,
                });
                scheduledCount++;
            }

            console.log(`✅ Successfully scheduled ${scheduledCount} monitor jobs.`);

            // Also check for daily deals
            await this.runDealCheck();

        } catch (error) {
            console.error('❌ Error during scheduler run:', error);
        }
    }

    private async runDealCheck() {
        // Run deal check roughly once a day (e.g., at 9 AM, or just blindly queue and let idempotency handle it)
        // Since addDealScanJob generates a daily ID, we can just call it every hour.
        // BullMQ/Redis will ignore duplicates if the ID matches.

        try {
            // 'ALL' means scan all enabled providers
            await addDealScanJob({ providerId: 'ALL' });
            console.log('⏰ Queued daily deal scan (idempotent)');
        } catch (error) {
            console.error('❌ Failed to queue deal scan:', error);
        }
    }
}

export const scheduler = new Scheduler();
