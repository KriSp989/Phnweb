const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const clients = new Map();

function generateId() {
    return Math.random().toString(36).substring(2, 8);
}

wss.on('connection', (ws) => {
    const clientId = generateId();
    clients.set(ws, { id: clientId, name: `User_${clientId}` });
    console.log(`✅ Подключен: ${clientId}, всего: ${clients.size}`);

    ws.send(JSON.stringify({ type: 'init', id: clientId }));
    broadcastParticipants();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📨 ${data.type} от ${clientId}`);

            if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
                const target = findClientById(data.target);
                if (target && target.ws.readyState === WebSocket.OPEN) {
                    target.ws.send(JSON.stringify({ ...data, from: clientId }));
                }
            } else if (data.type === 'chat') {
                broadcastChat(clientId, data.message, data.name);
            } else if (data.type === 'setName') {
                const client = clients.get(ws);
                if (client) {
                    client.name = data.name;
                    broadcastParticipants();
                }
            }
        } catch(e) {
            console.error('Ошибка:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        broadcastParticipants();
        console.log(`❌ Отключен: ${clientId}, осталось: ${clients.size}`);
    });
});

function findClientById(id) {
    for (let [ws, client] of clients) {
        if (client.id === id) return { ws, ...client };
    }
    return null;
}

function broadcastParticipants() {
    const participants = Array.from(clients.values()).map(c => ({ id: c.id, name: c.name }));
    const message = JSON.stringify({ type: 'participants', participants });
    clients.forEach((_, ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
}

function broadcastChat(fromId, message, fromName) {
    const chatMessage = JSON.stringify({
        type: 'chat',
        from: fromId,
        fromName: fromName,
        message: message,
        time: new Date().toLocaleTimeString()
    });
    clients.forEach((_, ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(chatMessage);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});