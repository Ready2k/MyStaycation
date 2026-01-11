import { AppDataSource } from '../config/database';
import { Alert, AlertChannel, AlertStatus } from '../entities/Alert';
import { Insight } from '../entities/Insight';
import { User } from '../entities/User';
import { emailService } from './email.service';
import * as crypto from 'crypto';

const alertRepo = AppDataSource.getRepository(Alert);
const userRepo = AppDataSource.getRepository(User);
const insightRepo = AppDataSource.getRepository(Insight);

export class AlertService {
    /**
     * Create alert for an insight
     */
    async createAlert(
        userId: string,
        insightId: string,
        _profileId?: string
    ): Promise<Alert | null> {
        const user = await userRepo.findOne({ where: { id: userId } });
        const insight = await insightRepo.findOne({
            where: { id: insightId },
            relations: ['fingerprint', 'fingerprint.profile'],
        });

        if (!user || !insight) {
            return null;
        }

        // Check if user has notifications enabled
        if (!user.notificationsEnabled) {
            console.log(`User ${userId} has notifications disabled`);
            return null;
        }

        // Check if fingerprint is snoozed
        if (insight.fingerprint?.snoozedUntil && new Date(insight.fingerprint.snoozedUntil) > new Date()) {
            console.log(`Fingerprint ${insight.fingerprint.id} is snoozed until ${insight.fingerprint.snoozedUntil}`);
            return null;
        }

        // Generate dedupe key (user + insight type + fingerprint + 7 days)
        // Generate dedupe key with dynamic window based on sensitivity
        const sensitivity = insight.fingerprint?.profile?.alertSensitivity || 'INSTANT';
        const dedupeKey = this.generateDedupeKey(userId, insight, sensitivity);

        // Check if similar alert was sent recently (7 days)
        const existingAlert = await alertRepo.findOne({
            where: { dedupeKey },
        });

        if (existingAlert) {
            console.log(`Alert already sent for dedupe key ${dedupeKey}`);
            return null;
        }

        // Create alert
        const alert = alertRepo.create({
            user: { id: userId },
            insight: { id: insightId },
            channel: AlertChannel.EMAIL,
            status: AlertStatus.PENDING,
            dedupeKey,
        });

        await alertRepo.save(alert);

        // Send email if channel is email
        if (alert.channel === AlertChannel.EMAIL) {
            await this.sendAlertEmail(alert);
        }

        return alert;
    }

    /**
     * Send alert email
     */
    private async sendAlertEmail(alert: Alert): Promise<void> {
        try {
            const alertWithRelations = await alertRepo.findOne({
                where: { id: alert.id },
                relations: ['user', 'insight', 'insight.fingerprint', 'insight.fingerprint.profile'],
            });

            if (!alertWithRelations) {
                throw new Error('Alert not found');
            }

            const user = alertWithRelations.user;
            const insight = alertWithRelations.insight;
            const profile = insight.fingerprint.profile;

            await emailService.sendAlertEmail(user.email, {
                profileName: profile.name,
                insightSummary: insight.summary,
                details: insight.details,
            });

            // Update alert status
            alertWithRelations.status = AlertStatus.SENT;
            alertWithRelations.sentAt = new Date();
            await alertRepo.save(alertWithRelations);

            console.log(`✅ Alert email sent to ${user.email}`);
        } catch (error) {
            console.error('Failed to send alert email:', error);
            alert.status = AlertStatus.FAILED;
            await alertRepo.save(alert);
        }
    }

    /**
     * Generate dedupe key for alert
     */
    /**
     * Generate dedupe key for alert with dynamic time window
     */
    private generateDedupeKey(userId: string, insight: Insight, sensitivity: string): string {
        const now = new Date();
        const windowStart = new Date(now);

        // Adjust window based on sensitivity
        // INSTANT: 24 hours (1/day)
        // DIGEST: 7 days (1/week)
        // EXCEPTIONAL_ONLY: 7 days (1/week) + high significance filter (handled in caller usually, but here just frequency)

        let daysToSubtract = 1; // Default INSTANT (24h)

        if (sensitivity === 'DIGEST') {
            daysToSubtract = 7;
        } else if (sensitivity === 'EXCEPTIONAL_ONLY') {
            daysToSubtract = 7;
        }

        windowStart.setDate(now.getDate() - daysToSubtract);

        const data = `${userId}:${insight.type}:${insight.fingerprint.id}:${windowStart.toISOString().split('T')[0]}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Snooze alerts for a fingerprint
     */
    async snoozeFingerprint(fingerprintId: string, days: number): Promise<void> {
        const fingerprintRepo = AppDataSource.getRepository('SearchFingerprint');
        const fingerprint = await fingerprintRepo.findOne({ where: { id: fingerprintId } });

        if (fingerprint) {
            const until = new Date();
            until.setDate(until.getDate() + days);
            (fingerprint as any).snoozedUntil = until;
            await fingerprintRepo.save(fingerprint);
            console.log(`Fingerprint ${fingerprintId} snoozed for ${days} days`);
        }
    }

    /**
     * Get alerts for a user
     */
    async getUserAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
        return alertRepo.find({
            where: { user: { id: userId } },
            relations: ['insight', 'profile'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    /**
     * Mark alert as dismissed
     */
    async dismissAlert(alertId: string): Promise<void> {
        const alert = await alertRepo.findOne({ where: { id: alertId } });
        if (alert) {
            alert.status = AlertStatus.DISMISSED;
            await alertRepo.save(alert);
        }
    }
}

export const alertService = new AlertService();
