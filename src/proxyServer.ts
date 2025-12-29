import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

let proxyServer: http.Server | null = null;

export function startProxyServer(): void {
    if (proxyServer) {
        console.log('[ProxyServer] Already running');
        return;
    }

    console.log('[ProxyServer] Starting on localhost:8888...');

    // Read blocked.html content
    const blockedHtmlPath = path.join(__dirname, '../renderer/blocked.html');
    const blockedHtml = fs.readFileSync(blockedHtmlPath, 'utf-8');

    // Create HTTP server that serves blocked.html for ALL requests
    proxyServer = http.createServer((req, res) => {
        console.log(`[ProxyServer] Intercepted request: ${req.url}`);

        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(blockedHtml);
    });

    proxyServer.listen(8888, 'localhost', () => {
        console.log('[ProxyServer] Listening on http://localhost:8888');
    });

    proxyServer.on('error', (err) => {
        console.error('[ProxyServer] Error:', err.message);
    });
}

export function stopProxyServer(): void {
    if (!proxyServer) {
        console.log('[ProxyServer] Not running');
        return;
    }

    console.log('[ProxyServer] Stopping...');

    proxyServer.close(() => {
        console.log('[ProxyServer] Stopped');
    });

    proxyServer = null;
}
