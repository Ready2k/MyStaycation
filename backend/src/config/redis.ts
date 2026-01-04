import IORedis from 'ioredis';

// Single Redis connection instance
export const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
    console.log('✅ Redis connected');
});

redisConnection.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});

export default redisConnection;