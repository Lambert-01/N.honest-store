const express = require('express');
const http = require('http');
const NotificationServer = require('./websocket');
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket notification server
const notificationServer = new NotificationServer(server);

// Make notificationServer available to routes
app.set('notificationServer', notificationServer);

// ... rest of your existing express configuration ...

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 