import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { alertService } from '../services/alert.service';
import z from 'zod';

const snoozeSchema = z.object({
    fingerprintId: z.string().uuid(),
    days: z.number().int().min(1).max(30).default(7)
});

export async function alertRoutes(fastify: FastifyInstance) {
    // POST /snooze - Snooze a fingerprint
    fastify.post('/snooze', {
        onRequest: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { fingerprintId, days } = snoozeSchema.parse(request.body);

            // TODO: Ideally verify the fingerprint belongs to a profile owned by the user
            // For now, relying on the fact that only valid fingerprints exist and random UUID guessing is hard

            await alertService.snoozeFingerprint(fingerprintId, days);

            return reply.send({ message: `Alerts snoozed for ${days} days` });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to snooze alerts' });
        }
    });

    // TODO: GET /alerts - List past alerts
}
