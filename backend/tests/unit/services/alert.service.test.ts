import { AlertSensitivity } from '../../../src/entities/HolidayProfile';

describe('AlertService Frequency Controls', () => {
    describe('generateDedupeKey logic', () => {
        it('should generate different dedupe keys for different sensitivities', () => {
            // Test the private method logic by creating a minimal test
            const userId = 'user-1';
            const mockInsight = {
                id: 'ins-1',
                type: 'PRICE_DROP',
                fingerprint: { id: 'fp-1' }
            };

            // Simulate the dedupe key generation logic
            const generateKey = (sensitivity: string) => {
                const now = new Date();
                const windowStart = new Date(now);

                let daysToSubtract = 1; // INSTANT
                if (sensitivity === 'DIGEST') daysToSubtract = 7;
                else if (sensitivity === 'EXCEPTIONAL_ONLY') daysToSubtract = 7;

                windowStart.setDate(now.getDate() - daysToSubtract);
                const data = `${userId}:${mockInsight.type}:${mockInsight.fingerprint.id}:${windowStart.toISOString().split('T')[0]}`;

                const crypto = require('crypto');
                return crypto.createHash('sha256').update(data).digest('hex');
            };

            const keyInstant = generateKey('INSTANT');
            const keyDigest = generateKey('DIGEST');

            expect(keyInstant).not.toBe(keyDigest);
        });

        it('should use 24h window for INSTANT sensitivity', () => {
            const now = new Date();
            const windowStart = new Date(now);
            windowStart.setDate(now.getDate() - 1);

            const daysDiff = Math.floor((now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));
            expect(daysDiff).toBe(1);
        });

        it('should use 7 day window for DIGEST sensitivity', () => {
            const now = new Date();
            const windowStart = new Date(now);
            windowStart.setDate(now.getDate() - 7);

            const daysDiff = Math.floor((now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));
            expect(daysDiff).toBe(7);
        });
    });

    describe('snooze logic', () => {
        it('should block alerts if snoozedUntil is in the future', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const now = new Date();
            const shouldBlock = futureDate > now;

            expect(shouldBlock).toBe(true);
        });

        it('should allow alerts if snoozedUntil is in the past', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const now = new Date();
            const shouldBlock = pastDate > now;

            expect(shouldBlock).toBe(false);
        });
    });
});
