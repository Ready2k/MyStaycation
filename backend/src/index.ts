import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profiles';
import { searchRoutes } from './routes/search';
import { insightsRoutes } from './routes/insights';
import { alertRoutes } from './routes/alerts';
import { usersRoutes } from './routes/users';
import { adminRoutes } from './routes/admin';
import { authenticate, requireAdmin } from './middleware/auth';
import { SystemLogger } from './services/SystemLogger';



dotenv.config();

// Validate critical environment variables
function validateEnvironment() {
    const jwtSecret = process.env.JWT_SECRET || '';
    const minLength = parseInt(process.env.MIN_JWT_SECRET_LENGTH || '32');

    if (process.env.NODE_ENV === 'production') {
        if (!jwtSecret || jwtSecret.includes('change_me')) {
            console.error('❌ FATAL: JWT_SECRET must be set in production');
            process.exit(1);
        }

        if (jwtSecret.length < minLength) {
            console.error(`❌ FATAL: JWT_SECRET must be at least ${minLength} characters`);
            process.exit(1);
        }

        if (!process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD.includes('change_me')) {
            console.error('❌ FATAL: POSTGRES_PASSWORD must be set in production');
            process.exit(1);
        }
    }

    console.log('✅ Environment validation passed');
}

const fastify = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});

async function start() {
    try {
        // Validate environment first
        validateEnvironment();

        // Initialize database
        await initializeDatabase();

        // Register plugins
        await fastify.register(cors, {
            origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            credentials: true,
        });

        await fastify.register(helmet, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
        });

        await fastify.register(jwt, {
            secret: process.env.JWT_SECRET || 'change_me_in_production',
        });

        await fastify.register(rateLimit, {
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
            timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        });

        // System Startup Log
        await SystemLogger.info('API Server Started', 'System', { port: process.env.PORT || 4000 });

        // Global Error Handler
        fastify.setErrorHandler(async (error, request, reply) => {
            const { method, url } = request;

            // Log to SystemLogger
            await SystemLogger.error(
                `API Error: ${error.message}`,
                'API_Global',
                {
                    code: error.code,
                    statusCode: error.statusCode,
                    method,
                    url,
                    stack: error.stack
                }
            );

            request.log.error(error);
            reply.status(error.statusCode || 500).send({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        });

        // Decorate fastify with authenticate method
        fastify.decorate('authenticate', authenticate);
        fastify.decorate('requireAdmin', requireAdmin);

        // Health check
        fastify.get('/health', async () => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        // Register routes
        await fastify.register(authRoutes);
        await fastify.register(profileRoutes);
        await fastify.register(searchRoutes);
        await fastify.register(insightsRoutes);
        await fastify.register(alertRoutes);
        await fastify.register(usersRoutes);
        await fastify.register(adminRoutes);

        // Start server
        const port = parseInt(process.env.PORT || '4000');
        const host = process.env.HOST || '0.0.0.0';

        await fastify.listen({ port, host });
        console.log(`🚀 Server running on http://${host}:${port}`);
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}

start();
