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
        reply.status(401).send({ error: 'Unauthorized' });
    }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
        const userId = (request.user as JWTPayload).userId;

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user || user.role !== UserRole.ADMIN) {
            reply.status(403).send({ error: 'Forbidden: Admin access required' });
        }
    } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
    }
}

export function getUserId(request: FastifyRequest): string {
    const payload = request.user as JWTPayload;
    return payload.userId;
}
