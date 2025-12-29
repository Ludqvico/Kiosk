import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

let webServer: http.Server | null = null;

export function startBlockedWebServer(): void {
    if (webServer) {
        console.log('[WebServer] Already running');
        return;
    }

    console.log('[WebServer] Starting on port 80...');

    // Read blocked.html content
    const blockedHtmlPath = path.join(__dirname, '../renderer/blocked.html');
    const blockedHtml = fs.readFileSync(blockedHtmlPath, 'utf-8');

    // Create HTTP server that serves blocked.html for ALL requests
    webServer = http.createServer((req, res) => {
        console.log(`[WebServer] Request: ${req.headers.host}${req.url}`);

        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(blockedHtml);
    });

    webServer.listen(80, '0.0.0.0', () => {
        console.log('[WebServer] Listening on http://0.0.0.0:80');
    });

    webServer.on('error', (err: any) => {
        if (err.code === 'EACCES') {
            console.error('[WebServer] ERROR: Port 80 requires Administrator privileges');
        } else {
            console.error('[WebServer] Error:', err.message);
        }
    });
}

export function stopBlockedWebServer(): void {
    if (!webServer) {
        console.log('[WebServer] Not running');
        return;
    }

    console.log('[WebServer] Stopping...');

    webServer.close(() => {
        console.log('[WebServer] Stopped');
    });

    webServer = null;
}
