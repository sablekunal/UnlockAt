import http from 'node:http';
import { parse } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import storeKeyHandler from '../api/store-key.js';
import requestKeyHandler from '../api/request-key.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const WEB_DIR = path.join(__dirname, '../web');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`[API/Static] ${req.method} ${pathname}`);

    // Mock Vercel response object
    const vercelRes = {
        status: (code) => {
            res.statusCode = code;
            return vercelRes;
        },
        json: (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end(JSON.stringify(data));
            return vercelRes;
        }
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // API Handlers
    if (pathname === '/api/store-key') {
        const vercelReq = await createVercelReq(req, parsedUrl);
        return await storeKeyHandler(vercelReq, vercelRes);
    }

    if (pathname === '/api/request-key') {
        const vercelReq = await createVercelReq(req, parsedUrl);
        return await requestKeyHandler(vercelReq, vercelRes);
    }

    // Static File Serving
    try {
        let filePath = path.join(WEB_DIR, pathname === '/' ? 'index.html' : pathname);
        const ext = path.extname(filePath);
        const content = await fs.readFile(filePath);
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not Found' }));
        } else {
            console.error('Static Server Error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    }
});

async function createVercelReq(req, parsedUrl) {
    return {
        method: req.method,
        query: parsedUrl.query,
        body: await new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch {
                    resolve({});
                }
            });
        })
    };
}

server.listen(PORT, () => {
    console.log(`\x1b[32m✔ UnlockAt Unified Server running at http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[36mℹ Serving Web UI from: ${WEB_DIR}\x1b[0m`);
});
