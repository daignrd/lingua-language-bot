import { WebSocketServer, WebSocket } from 'ws';

const WSS_PORT = 8080;
const wss = new WebSocketServer({ port: WSS_PORT });

let activeClients: WebSocket[] = [];

wss.on('connection', (ws) => {
    console.log('New Live Canvas client connected');
    activeClients.push(ws);

    ws.on('close', () => {
        console.log('Live Canvas client disconnected');
        activeClients = activeClients.filter(c => c !== ws);
    });
});

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

console.log(`Live Canvas WebSocket Server running on ws://localhost:${WSS_PORT}`);
