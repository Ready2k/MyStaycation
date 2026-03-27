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
            const userId = (request.user as any).userId;

            await alertService.snoozeFingerprint(fingerprintId, userId, days);

            return reply.send({ message: `Alerts snoozed for ${days} days` });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.issues });
            }
            if (error.message === 'Fingerprint not found or access denied') {
                return reply.code(404).send({ error: 'Fingerprint not found' });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to snooze alerts' });
        }
    });

    // TODO: GET /alerts - List past alerts
}
