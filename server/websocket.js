const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class NotificationServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map(); // Map to store admin connections
        this.init();
    }

    init() {
        this.wss.on('connection', (ws, req) => {
            // Handle new WebSocket connections
            const token = this.extractToken(req);
            
            if (!token) {
                ws.close(1008, 'Authentication required');
                return;
            }

            try {
                // Verify the JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.role !== 'admin') {
                    ws.close(1008, 'Admin access required');
                    return;
                }

                // Store the admin connection
                this.clients.set(ws, decoded);

                // Handle client disconnect
                ws.on('close', () => {
                    this.clients.delete(ws);
                });

                // Send initial connection success message
                ws.send(JSON.stringify({
                    type: 'connection',
                    message: 'Connected to notification server'
                }));

            } catch (error) {
                ws.close(1008, 'Invalid token');
            }
        });
    }

    // Extract JWT token from request
    extractToken(req) {
        const url = new URL(req.url, 'ws://localhost');
        return url.searchParams.get('token');
    }

    // Broadcast notification to all connected admin clients
    broadcastNotification(notification) {
        const message = JSON.stringify({
            type: 'notification',
            data: notification
        });

        this.clients.forEach((userData, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Send notification to specific admin
    sendNotification(adminId, notification) {
        const message = JSON.stringify({
            type: 'notification',
            data: notification
        });

        this.clients.forEach((userData, client) => {
            if (userData.id === adminId && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

module.exports = NotificationServer; 