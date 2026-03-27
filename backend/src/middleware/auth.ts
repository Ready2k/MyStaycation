import { FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { JWTPayload } from '../types/common.types';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch (err) {
        request.log.warn({
            url: request.url,
            method: request.method,
            reason: 'missing_or_invalid_auth'
        }, 'Authentication failed');
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    try {
        // Ensure authenticated first
        await request.jwtVerify();
        const user = request.user as JWTPayload;

        const userRepo = AppDataSource.getRepository(User);
        const dbUser = await userRepo.findOne({ where: { id: user.userId } });

        if (!dbUser || dbUser.role !== UserRole.ADMIN) {
            request.log.warn({
                userId: user.userId,
                url: request.url,
                method: request.method,
                reason: 'not_admin'
            }, 'Authorization denied: Admin access required');
            return reply.status(403).send({ error: 'Forbidden: Admin access required' });
        }
    } catch (err) {
        request.log.warn({
            url: request.url,
            method: request.method,
            reason: 'invalid_auth_token'
        }, 'Authorization failed during admin check');
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}

export function getUserId(request: FastifyRequest): string {
    const payload = request.user as JWTPayload;
    return payload.userId;
}
