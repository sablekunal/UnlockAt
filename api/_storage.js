import { kv } from '@vercel/kv';
import { createClient } from 'redis';

// Local memory fallback
const localStore = new Map();

// Helper to get discovery variables
const getRedisConfig = () => {
    const env = process.env;

    // 1. Try Vercel KV (REST)
    if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
        return { type: 'vercel-kv', client: kv };
    }

    // 2. Try Upstash Redis (REST)
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        return { type: 'vercel-kv', client: kv }; // @vercel/kv uses these under the hood
    }

    // 3. Try Standard Redis (TCP) - Support common names and user's custom name
    const redisUrl = env.REDIS_URL || env.UNLOCKAT_REDIS_URL || env.KV_URL;
    if (redisUrl) {
        return { type: 'redis', url: redisUrl };
    }

    return { type: 'memory' };
};

const config = getRedisConfig();
let redisClient = null;

if (config.type === 'redis') {
    redisClient = createClient({ url: config.url });
    redisClient.on('error', err => console.error('Redis Client Error', err));
    // Note: In serverless, we'll connect on-demand if needed, but for simplicity:
    redisClient.connect().catch(console.error);
}

export const getStorage = () => {
    return {
        type: config.type,
        set: async (key, value) => {
            if (config.type === 'vercel-kv') {
                return await kv.set(key, value);
            }
            if (config.type === 'redis') {
                return await redisClient.set(key, JSON.stringify(value));
            }
            return localStore.set(key, value);
        },
        get: async (key) => {
            if (config.type === 'vercel-kv') {
                return await kv.get(key);
            }
            if (config.type === 'redis') {
                const val = await redisClient.get(key);
                return val ? JSON.parse(val) : null;
            }
            return localStore.get(key);
        }
    };
};
