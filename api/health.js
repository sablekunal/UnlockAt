export default async function handler(req, res) {
    const isVercel = !!process.env.VERCEL;

    // Check for any common Redis/KV environment variables
    const redisVars = Object.keys(process.env).filter(key =>
        key.includes('REDIS') || key.includes('KV_')
    );

    const hasPersistence = redisVars.length > 0;
    const storageStatus = hasPersistence ? 'persistent' : 'volatile (memory)';

    return res.status(200).json({
        status: 'ok',
        environment: isVercel ? 'production' : 'development',
        storage: storageStatus,
        foundVars: redisVars, // Show which variables were found for debugging
        hasKV: hasPersistence
    });
}
