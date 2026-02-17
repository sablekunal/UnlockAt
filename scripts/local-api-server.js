import http from 'node:http';
import { parse } from 'node:url';
import storeKeyHandler from '../api/store-key.js';
import requestKeyHandler from '../api/request-key.js';

const PORT = 3000;

const server = http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`[API] ${req.method} ${pathname}`);

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

    // Mock Vercel request object
    const vercelReq = {
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

    try {
        if (pathname === '/api/store-key') {
            await storeKeyHandler(vercelReq, vercelRes);
        } else if (pathname === '/api/request-key') {
            await requestKeyHandler(vercelReq, vercelRes);
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } catch (err) {
        console.error('API Error:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
});

server.listen(PORT, () => {
    console.log(`\x1b[32m✔ Local API Server running at http://localhost:${PORT}\x1b[0m`);
});
