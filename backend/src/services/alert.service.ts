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
        profileId?: string
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

        // Generate dedupe key (user + insight type + fingerprint + 7 days)
        const dedupeKey = this.generateDedupeKey(userId, insight);

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
            profile: profileId ? { id: profileId } : undefined,
            insight: { id: insightId },
            channel: AlertChannel.EMAIL,
            status: AlertStatus.QUEUED,
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
    private generateDedupeKey(userId: string, insight: Insight): string {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);

        const data = `${userId}:${insight.type}:${insight.fingerprint.id}:${weekStart.toISOString().split('T')[0]}`;
        return crypto.createHash('sha256').update(data).digest('hex');
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
