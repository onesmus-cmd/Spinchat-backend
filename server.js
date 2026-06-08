const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with global Cross-Origin Resource Sharing (CORS) allowed
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Production in-memory registries (Clears if server restarts)
// Maps socket.id to the registered username string
const connectedUsers = {}; 

io.on('connection', (socket) => {
    console.log(`[NODE_CONNECTED]: Socket ID ${socket.id}`);

    // Handle Client Registration
    socket.on('register_user', (username) => {
        const cleanName = username.trim().toLowerCase();
        
        // Save the username mapped to this specific network connection ID
        connectedUsers[socket.id] = cleanName;
        console.log(`[USER_REGISTERED]: ID: ${socket.id} mapped to identity: ${cleanName.toUpperCase()}`);
        
        // Broadcast the updated active directory list to all connected clients
        const userList = Object.values(connectedUsers);
        io.emit('directory_update', userList);
    });

    // Handle Private Message Routing
    socket.on('send_private_message', (data) => {
        const { targetUser, messageText, timestamp } = data;
        const cleanTarget = targetUser.trim().toLowerCase();
        const senderName = connectedUsers[socket.id];

        // Locate the socket ID belonging to the target username
        const targetSocketId = Object.keys(connectedUsers).find(
            key => connectedUsers[key] === cleanTarget
        );

        if (targetSocketId) {
            // Route payload securely to target socket client only
            io.to(targetSocketId).emit('receive_private_message', {
                sender: senderName.toUpperCase(),
                text: messageText,
                timestamp: timestamp
            });
            console.log(`[PAYLOAD_ROUTED]: From ${senderName.toUpperCase()} to ${cleanTarget.toUpperCase()}`);
        } else {
            console.log(`[ROUTING_FAILURE]: Target node ${cleanTarget.toUpperCase()} offline.`);
        }
    });

    // Handle Client Disconnections
    socket.on('disconnect', () => {
        const disconnectedUser = connectedUsers[socket.id];
        if (disconnectedUser) {
            console.log(`[NODE_DISCONNECTED]: User ${disconnectedUser.toUpperCase()} went offline.`);
            delete connectedUsers[socket.id];
            
            // Broadcast clean directory data to remaining active nodes
            const userList = Object.values(connectedUsers);
            io.emit('directory_update', userList);
        }
    });
});

// Bind to port assigned by Render, or fall back to 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=================================`);
    console.log(` SPINCHAT CORE BACKEND ONLINE`);
    console.log(` Listening on port: ${PORT}`);
    console.log(`=================================\n`);
});
