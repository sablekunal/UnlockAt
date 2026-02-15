import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Basic support for both GET (for easy testing) and POST
    const keyId = req.query.keyId || req.body?.keyId;

    if (!keyId) {
        return res.status(400).json({ error: 'Missing keyId' });
    }

    try {
        const data = await kv.get(`unlockat:${keyId}`);

        if (!data) {
            return res.status(404).json({ error: 'Key not found' });
        }

        const now = Date.now();
        const { fragmentB, targetTimestamp } = data;

        if (now < targetTimestamp) {
            const remainingSecs = Math.ceil((targetTimestamp - now) / 1000);
            return res.status(403).json({
                error: 'File is still locked',
                remainingSeconds: remainingSecs,
                unlockDate: new Date(targetTimestamp).toISOString()
            });
        }

        // Time gate passed! Release the key fragment.
        return res.status(200).json({
            fragmentB,
            status: 'unlocked'
        });
    } catch (error) {
        console.error('Request key error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
