import { kv } from '@vercel/kv';
import { localStore } from './_storage.js';

export default async function handler(req, res) {
    const keyId = req.query.keyId || req.body?.keyId;

    if (!keyId) {
        return res.status(400).json({ error: 'Missing keyId' });
    }

    try {
        let data;
        if (process.env.KV_REST_API_URL) {
            data = await kv.get(`unlockat:${keyId}`);
        } else {
            data = localStore.get(`unlockat:${keyId}`);
        }

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

        return res.status(200).json({
            fragmentB,
            status: 'unlocked'
        });
    } catch (error) {
        console.error('Request key error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
