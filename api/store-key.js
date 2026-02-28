import { randomBytes } from 'node:crypto';
import { getStorage } from './_storage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { fragmentB, targetTimestamp } = req.body;

    if (!fragmentB || !targetTimestamp) {
        return res.status(400).json({ error: 'Missing fragmentB or targetTimestamp' });
    }

    try {
        const keyId = randomBytes(16).toString('hex');
        const finalTimestamp = parseInt(targetTimestamp);

        if (isNaN(finalTimestamp)) {
            return res.status(400).json({ error: 'Invalid targetTimestamp' });
        }

        const data = {
            fragmentB,
            targetTimestamp: finalTimestamp
        };

        const storage = getStorage();
        await storage.set(`unlockat:${keyId}`, data);

        return res.status(200).json({
            keyId,
            status: 'locked',
            unlockDate: new Date(targetTimestamp).toISOString(),
            storage: storage.type
        });
    } catch (error) {
        console.error('Store key error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
