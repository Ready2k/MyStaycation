import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { authRoutes } from './routes/auth';
import { authenticate } from './middleware/auth';

dotenv.config();

const fastify = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});

async function start() {
    try {
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

        // Decorate fastify with authenticate method
        fastify.decorate('authenticate', authenticate);

        // Health check
        fastify.get('/health', async () => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        // Register routes
        await fastify.register(authRoutes);

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
