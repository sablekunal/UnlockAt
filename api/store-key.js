import { kv } from '@vercel/kv';
import { randomBytes } from 'node:crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { fragmentB, targetDate } = req.body;

    if (!fragmentB || !targetDate) {
        return res.status(400).json({ error: 'Missing fragmentB or targetDate' });
    }

    try {
        // Generate a unique ID for this time lock
        const keyId = randomBytes(16).toString('hex');
        const targetTimestamp = new Date(targetDate).getTime();

        if (isNaN(targetTimestamp)) {
            return res.status(400).json({ error: 'Invalid targetDate' });
        }

        // Store the fragment and the release date
        await kv.set(`unlockat:${keyId}`, {
            fragmentB,
            targetTimestamp
        });

        return res.status(200).json({ 
            keyId,
            status: 'locked',
            unlockDate: new Date(targetTimestamp).toISOString()
        });
    } catch (error) {
        console.error('Store key error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
