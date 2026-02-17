import { kv } from '@vercel/kv';
import { randomBytes } from 'node:crypto';
import { localStore } from './_storage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { fragmentB, targetDate } = req.body;

    if (!fragmentB || !targetDate) {
        return res.status(400).json({ error: 'Missing fragmentB or targetDate' });
    }

    try {
        const keyId = randomBytes(16).toString('hex');
        const targetTimestamp = new Date(targetDate).getTime();

        if (isNaN(targetTimestamp)) {
            return res.status(400).json({ error: 'Invalid targetDate' });
        }

        const data = {
            fragmentB,
            targetTimestamp
        };

        // Use Vercel KV if configured, otherwise fallback to memory
        if (process.env.KV_REST_API_URL) {
            await kv.set(`unlockat:${keyId}`, data);
        } else {
            console.warn('⚠️ KV_REST_API_URL not found. Using local memory fallback.');
            localStore.set(`unlockat:${keyId}`, data);
        }

        return res.status(200).json({
            keyId,
            status: 'locked',
            unlockDate: new Date(targetTimestamp).toISOString(),
            storage: process.env.KV_REST_API_URL ? 'vercel-kv' : 'memory-fallback'
        });
    } catch (error) {
        console.error('Store key error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
