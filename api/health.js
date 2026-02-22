export default async function handler(req, res) {
    const isVercel = !!process.env.VERCEL;
    const hasKV = !!process.env.KV_REST_API_URL;

    return res.status(200).json({
        status: 'ok',
        environment: isVercel ? 'production' : 'development',
        storage: hasKV ? 'persistent (vercel-kv)' : 'volatile (memory)',
        hasKV
    });
}
