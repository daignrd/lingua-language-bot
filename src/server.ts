import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { handleCanvasConnection } from './services/canvas.ts';
import { handleLiveTutorConnection } from './services/live_tutor.ts';

const app = express();
const httpServer = createServer(app);

// Initialize a shared WebSocket server with no standalone port binding
const wss = new WebSocketServer({ noServer: true });

// Serve static files for the future Telegram Mini App compiled frontend
const frontendDistPath = path.join(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
}

// Fallback index.html route for Single Page Application routing (Vite)
app.get('*any', (req, res, next) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next();
    }
});

// Handle upgrade requests and route based on URL path
httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    console.log(`[Server] Received WebSocket upgrade request for path: ${pathname}`);

    if (pathname === '/canvas') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            handleCanvasConnection(ws);
        });
    } else if (pathname === '/live-tutor') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            handleLiveTutorConnection(ws);
        });
    } else {
        console.warn(`[Server] Rejecting connection upgrade for unrecognized path: ${pathname}`);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
    }
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
    console.log(`[Server] Unified Web & WebSockets server running on port ${PORT}`);
});

export { app, httpServer };
