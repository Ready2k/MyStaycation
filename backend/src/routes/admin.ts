import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { HolidayProfile } from '../entities/HolidayProfile';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { PriceObservation } from '../entities/PriceObservation';
import { FetchRun } from '../entities/FetchRun';
import { SystemLog } from '../entities/SystemLog';
import { Provider } from '../entities/Provider';
import { ProviderConfig } from '../entities/ProviderConfig';
import { monitorQueue, insightQueue, alertQueue, dealQueue } from '../jobs/queues';
import { authService } from '../services/auth.service';
import crypto from 'crypto';
import z from 'zod';

const userRepo = AppDataSource.getRepository(User);
const profileRepo = AppDataSource.getRepository(HolidayProfile);
const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
const observationRepo = AppDataSource.getRepository(PriceObservation);
const fetchRunRepo = AppDataSource.getRepository(FetchRun);
const logRepo = AppDataSource.getRepository(SystemLog);
const providerRepo = AppDataSource.getRepository(Provider);
const configRepo = AppDataSource.getRepository(ProviderConfig);

export async function adminRoutes(fastify: FastifyInstance) {
    // Apply admin guard to all routes in this plugin
    fastify.addHook('onRequest', fastify.requireAdmin);

    // --- USER MANAGEMENT ---

    // GET /admin/users - List all users
    fastify.get('/admin/users', async (request, reply) => {
        const users = await userRepo.find({
            relations: ['profiles'],
            order: { createdAt: 'DESC' }
        });

        // Map to safe DTO
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            createdAt: u.createdAt,
            profileCount: u.profiles.length,
            lastLogin: null // Add if tracking last login
        }));

        return { users: safeUsers };
    });

    // PATCH /admin/users/:id/role - Promote/Demote
    fastify.patch('/admin/users/:id/role', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: Object.values(UserRole) }
                },
                required: ['role']
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const { role } = request.body as any;

        const user = await userRepo.findOne({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'User not found' });

        user.role = role;
        await userRepo.save(user);

        return { success: true, user: { id: user.id, email: user.email, role: user.role } };
    });

    // POST /admin/users/:id/reset-password - Admin reset
    fastify.post('/admin/users/:id/reset-password', async (request, reply) => {
        const { id } = request.params as any;

        const user = await userRepo.findOne({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'User not found' });

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await authService.hashPassword(tempPassword);

        user.passwordHash = hashedPassword;
        user.emailVerified = true; // Admin intervention implies verification
        user.verificationToken = undefined;
        await userRepo.save(user);

        // In real world, email this. For now return it.
        return { success: true, tempPassword };
    });

    // DELETE /admin/users/:id - Admin delete user
    fastify.delete('/admin/users/:id', async (request, reply) => {
        const { id } = request.params as any;
        const adminId = (request as any).user.userId;

        if (id === adminId) {
            return reply.code(400).send({ error: 'Cannot delete your own account via Admin API. Use Settings page.' });
        }

        const user = await userRepo.findOne({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'User not found' });

        await userRepo.remove(user); // Cascade deletes profiles, etc.

        return { success: true };
    });


    // --- DATABASE STATS ---

    // GET /admin/stats/database
    fastify.get('/admin/stats/database', async (request, reply) => {
        const [
            userCount,
            profileCount,
            fingerprintCount,
            observationCount,
            fetchRunCount,
            logCount
        ] = await Promise.all([
            userRepo.count(),
            profileRepo.count(),
            fingerprintRepo.count(),
            observationRepo.count(),
            fetchRunRepo.count(),
            logRepo.count()
        ]);

        return {
            users: userCount,
            profiles: profileCount,
            fingerprints: fingerprintCount,
            observations: observationCount,
            fetchRuns: fetchRunCount,
            logs: logCount
        };
    });


    // --- WATCHER MANAGEMENT ---

    // GET /admin/watchers
    fastify.get('/admin/watchers', async (request, reply) => {
        const profiles = await profileRepo.find({
            relations: ['user', 'fingerprints'],
            order: { createdAt: 'DESC' },
            take: 100 // Limit for now
        });

        return {
            watchers: profiles.map(p => ({
                id: p.id,
                name: p.name,
                user: { id: p.user?.id, email: p.user?.email },
                target: `${p.region || 'Any'} (${p.partySizeAdults}A/${p.partySizeChildren}C)`,
                fingerprintCount: p.fingerprints.length,
                createdAt: p.createdAt
            }))
        };
    });

    // DELETE /admin/watchers/:id
    fastify.delete('/admin/watchers/:id', async (request, reply) => {
        const { id } = request.params as any;
        await profileRepo.delete(id); // Cascade should handle children
        return { success: true };
    });


    // --- SYSTEM PERFORMANCE & LOGS ---

    // GET /admin/performance
    fastify.get('/admin/performance', async (request, reply) => {
        const getQueueMetrics = async (queue: any, name: string) => {
            const counts = await queue.getJobCounts('active', 'completed', 'failed', 'delayed', 'paused');
            return { name, ...counts };
        };

        const queues = [
            await getQueueMetrics(monitorQueue, 'Monitor'),
            await getQueueMetrics(insightQueue, 'Insights'),
            await getQueueMetrics(alertQueue, 'Alerts'),
            await getQueueMetrics(dealQueue, 'Deals'),
        ];

        return { queues };
    });

    // GET /admin/logs
    fastify.get('/admin/logs', async (request, reply) => {
        const { limit = 50, level } = request.query as any;

        const query = logRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC').take(limit);

        if (level) {
            query.where('log.level = :level', { level });
        }

        const logs = await query.getMany();
        return { logs };
    });

    // DELETE /admin/logs
    fastify.delete('/admin/logs', async (request, reply) => {
        await logRepo.clear();
        return { success: true };
    });

    // --- PROVIDER CONFIGURATION ---

    // GET /admin/providers - List all providers
    fastify.get('/admin/providers', async (request, reply) => {
        const providers = await providerRepo.find({ order: { code: 'ASC' } });
        return { providers };
    });

    // GET /admin/providers/:code/config - Get all config for a provider
    fastify.get('/admin/providers/:code/config', async (request, reply) => {
        const { code } = request.params as any;

        const provider = await providerRepo.findOne({ where: { code } });
        if (!provider) return reply.code(404).send({ error: 'Provider not found' });

        const configs = await configRepo.find({
            where: { provider: { id: provider.id } },
            order: { configType: 'ASC', key: 'ASC' }
        });

        return { configs };
    });

    // GET /admin/providers/:code/config/:type - Get specific config type
    fastify.get('/admin/providers/:code/config/:type', async (request, reply) => {
        const { code, type } = request.params as any;

        const provider = await providerRepo.findOne({ where: { code } });
        if (!provider) return reply.code(404).send({ error: 'Provider not found' });

        const configs = await configRepo.find({
            where: { provider: { id: provider.id }, configType: type },
            order: { key: 'ASC' }
        });

        return { configs };
    });

    // POST /admin/providers/:code/config - Create new config entry
    fastify.post('/admin/providers/:code/config', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    configType: { type: 'string' },
                    key: { type: 'string' },
                    value: { type: 'string' },
                    enabled: { type: 'boolean' },
                    metadata: { type: 'object' }
                },
                required: ['configType', 'key', 'value']
            }
        }
    }, async (request, reply) => {
        const { code } = request.params as any;
        const { configType, key, value, enabled = true, metadata } = request.body as any;

        const provider = await providerRepo.findOne({ where: { code } });
        if (!provider) return reply.code(404).send({ error: 'Provider not found' });

        // Check for duplicate
        const existing = await configRepo.findOne({
            where: { provider: { id: provider.id }, configType, key }
        });

        if (existing) {
            return reply.code(409).send({ error: 'Config entry already exists' });
        }

        const config = configRepo.create({
            provider,
            configType,
            key,
            value,
            enabled,
            metadata
        });

        await configRepo.save(config);
        return { success: true, config };
    });

    // PUT /admin/providers/:code/config/:id - Update config entry
    fastify.put('/admin/providers/:code/config/:id', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    enabled: { type: 'boolean' },
                    metadata: { type: 'object' }
                }
            }
        }
    }, async (request, reply) => {
        const { code, id } = request.params as any;
        const { value, enabled, metadata } = request.body as any;

        const provider = await providerRepo.findOne({ where: { code } });
        if (!provider) return reply.code(404).send({ error: 'Provider not found' });

        const config = await configRepo.findOne({
            where: { id, provider: { id: provider.id } }
        });

        if (!config) return reply.code(404).send({ error: 'Config not found' });

        if (value !== undefined) config.value = value;
        if (enabled !== undefined) config.enabled = enabled;
        if (metadata !== undefined) config.metadata = metadata;

        await configRepo.save(config);
        return { success: true, config };
    });

    // DELETE /admin/providers/:code/config/:id - Delete config entry
    fastify.delete('/admin/providers/:code/config/:id', async (request, reply) => {
        const { code, id } = request.params as any;

        const provider = await providerRepo.findOne({ where: { code } });
        if (!provider) return reply.code(404).send({ error: 'Provider not found' });

        const config = await configRepo.findOne({
            where: { id, provider: { id: provider.id } }
        });

        if (!config) return reply.code(404).send({ error: 'Config not found' });

        await configRepo.remove(config);
        return { success: true };
    });
}
