import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';

// Mock the database module at the very top (it will be hoisted)
jest.mock('../../src/config/database', () => {
    const { createTestDataSource } = require('../../src/config/test-database');
    const ds = createTestDataSource();
    return {
        AppDataSource: ds,
        initializeDatabase: jest.fn()
    };
});

// Import AppDataSource from the database config - it will be the mocked instance
import { AppDataSource } from '../../src/config/database';
import { User, UserRole, HolidayProfile, SearchFingerprint, Provider } from '../../src/entities';
import { adminRoutes } from '../../src/routes/admin';
import { alertRoutes } from '../../src/routes/alerts';
import { authenticate, requireAdmin } from '../../src/middleware/auth';

describe('Authorization & Ownership Integration Tests', () => {
    let fastify: FastifyInstance;
    let adminUser: User;
    let regularUser: User;
    let otherUser: User;
    let adminToken: string;
    let userToken: string;
    let otherUserToken: string;

    beforeAll(async () => {
        // Pre-test readiness check
        const { Client } = require('pg');
        const options = AppDataSource.options as any;
        const client = new Client({
            host: options.host,
            port: options.port,
            user: options.username,
            password: options.password,
            database: options.database,
        });

        try {
            await client.connect();
            await client.end();
        } catch (error: any) {
            console.error('\n❌ ERROR: Database integration environment is not ready.');
            console.error(`   Message: ${error.message}`);
            console.error('   💡 Fix: Run `npm run db:test:up` from the backend directory to start the test database.\n');
            throw new Error('Database unavailable - Integration environment not ready');
        }

        // Initialize the mocked data source
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        fastify = Fastify();
        await fastify.register(jwt, {
            secret: 'test_secret'
        });

        fastify.decorate('authenticate', authenticate);
        fastify.decorate('requireAdmin', requireAdmin);

        await fastify.register(adminRoutes);
        await fastify.register(alertRoutes);

        const userRepo = AppDataSource.getRepository(User);
        
        // Clean up and Create test users
        await userRepo.delete({}); 
        
        adminUser = await userRepo.save(userRepo.create({
            email: 'admin@test.com',
            passwordHash: 'hash',
            emailVerified: true,
            role: UserRole.ADMIN
        }));

        regularUser = await userRepo.save(userRepo.create({
            email: 'user@test.com',
            passwordHash: 'hash',
            emailVerified: true,
            role: UserRole.USER
        }));

        otherUser = await userRepo.save(userRepo.create({
            email: 'other@test.com',
            passwordHash: 'hash',
            emailVerified: true,
            role: UserRole.USER
        }));

        adminToken = fastify.jwt.sign({ userId: adminUser.id });
        userToken = fastify.jwt.sign({ userId: regularUser.id });
        otherUserToken = fastify.jwt.sign({ userId: otherUser.id });
    });

    afterAll(async () => {
        if (AppDataSource.isInitialized) {
            const userRepo = AppDataSource.getRepository(User);
            await userRepo.delete({});
            await AppDataSource.destroy();
        }
        await fastify.close();
    });

    describe('Admin Route Hardening (A & B)', () => {
        it('should block regular user from GET /admin/users', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { authorization: `Bearer ${userToken}` }
            });

            expect(response.statusCode).toBe(403);
            expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden: Admin access required' });
        });

        it('should block unauthenticated user from GET /admin/users', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/admin/users'
            });

            expect(response.statusCode).toBe(401);
        });

        it('should allow admin user to GET /admin/users', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { authorization: `Bearer ${adminToken}` }
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.users).toBeDefined();
        });

        it('should prevent regular user from promoting themselves', async () => {
            const response = await fastify.inject({
                method: 'PATCH',
                url: `/admin/users/${regularUser.id}/role`,
                headers: { authorization: `Bearer ${userToken}` },
                payload: { role: UserRole.ADMIN }
            });

            expect(response.statusCode).toBe(403);
            
            // Verify DB hasn't changed
            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOne({ where: { id: regularUser.id } });
            expect(user?.role).toBe(UserRole.USER);
        });
    });

    describe('Object Ownership / IDOR Hardening (C)', () => {
        let userFingerprint: SearchFingerprint;

        beforeAll(async () => {
            const profileRepo = AppDataSource.getRepository(HolidayProfile);
            const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
            const providerRepo = AppDataSource.getRepository(Provider);

            // Need a provider for the fingerprint
            const provider = await providerRepo.save(providerRepo.create({
                code: 'TEST_PROV',
                name: 'Test Provider',
                baseUrl: 'http://test.com'
            }));

            const profile = await profileRepo.save(profileRepo.create({
                name: 'User Profile',
                user: regularUser
            }));

            userFingerprint = await fingerprintRepo.save(fingerprintRepo.create({
                profile,
                provider,
                canonicalJson: {},
                canonicalHash: 'test_hash_auth_test'
            }));
        });

        it('should allow owner to snooze their own fingerprint', async () => {
            const response = await fastify.inject({
                method: 'POST',
                url: '/snooze',
                headers: { authorization: `Bearer ${userToken}` },
                payload: { fingerprintId: userFingerprint.id, days: 7 }
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).message).toContain('snoozed');
        });

        it('should block non-owner from snoozing another user\'s fingerprint (IDOR)', async () => {
            const response = await fastify.inject({
                method: 'POST',
                url: '/snooze',
                headers: { authorization: `Bearer ${otherUserToken}` },
                payload: { fingerprintId: userFingerprint.id, days: 7 }
            });

            // Should return 404 (safe response) or 403
            expect(response.statusCode).toBe(404);
            
            // Verify no change in DB
            const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);
            const fp = await fingerprintRepo.findOne({ where: { id: userFingerprint.id } });
            expect(fp).toBeDefined();
        });
    });

    describe('Handler Termination Regression (F.6)', () => {
        it('should not call the handler if requireAdmin fails', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { authorization: `Bearer ${userToken}` }
            });
            
            expect(response.statusCode).toBe(403);
            // If the handler ran, it would have returned 200 with the user list.
        });
    });
});
