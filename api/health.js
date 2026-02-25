import { getStorage } from './_storage.js';

export default async function handler(req, res) {
    const isVercel = !!process.env.VERCEL;
    const storageManager = getStorage();

    // Check for any common Redis/KV environment variables for debugging
    const redisVars = Object.keys(process.env).filter(key =>
        key.includes('REDIS') || key.includes('KV_')
    );

    return res.status(200).json({
        status: 'ok',
        environment: isVercel ? 'production' : 'development',
        storageType: storageManager.type,
        foundVars: redisVars,
        hasPersistence: storageManager.type !== 'memory'
    });
}
