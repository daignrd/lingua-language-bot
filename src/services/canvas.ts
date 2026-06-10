import { WebSocket } from 'ws';

let activeClients: WebSocket[] = [];

/**
 * Handles incoming connection upgrades from the unified WebSocket server.
 */
export function handleCanvasConnection(ws: WebSocket) {
    console.log('[Canvas] New Live Canvas client connected.');
    activeClients.push(ws);

    ws.on('close', () => {
        console.log('[Canvas] Live Canvas client disconnected.');
        activeClients = activeClients.filter(c => c !== ws);
    });
}

/**
 * Pushes HTML content to all active Live Canvas clients.
 */
export function pushToCanvas(htmlContent: string) {
    if (activeClients.length === 0) {
        throw new Error('No active Canvas clients connected. Open the Canvas UI in a browser first.');
    }

    const payload = JSON.stringify({ type: 'update', content: htmlContent });

    for (const client of activeClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
