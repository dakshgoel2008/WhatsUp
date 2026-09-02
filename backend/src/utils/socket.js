import { Server } from "socket.io";
import http from "http";
import express from "express";
import { createAdapter } from "@socket.io/redis-adapter";
import { pubClient, subClient } from "./redisClient.js";

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === "production";
const devOrigins = process.env.CORS_ORIGINS ? JSON.parse(process.env.CORS_ORIGINS) : ["http://localhost:5173"];
const prodOrigin = process.env.PRODUCTION_CLIENT_URL;

// Build allowed origins array
let allowedOrigins = [];
if (isProduction) {
    if (prodOrigin) {
        allowedOrigins = prodOrigin.split(",").map((origin) => origin.trim());
    }
} else {
    allowedOrigins = devOrigins;
}

console.log("🔌 Socket.IO CORS Configuration:", allowedOrigins);

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, etc.)
            if (!origin) {
                return callback(null, true);
            }

            // Check if origin is allowed
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // In development, be permissive
            if (!isProduction) {
                return callback(null, true);
            }

            console.warn(`❌ Socket.IO: Origin not allowed: ${origin}`);
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST"],
    },
});

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Redis adapter configured for Socket.IO");
}).catch(err => {
    console.error("Failed to connect Redis pub/sub clients", err);
});

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

// for online users.
const userSocketMap = {}; // userid, socketid.

// Track active typers: userId -> Set of recipientIds they're typing to
const activeTypers = new Map();

// Setup typing event handlers
const setupTypingHandlers = (socket) => {
    // Handle typing start
    socket.on("typing-start", (data) => {
        const { recipientId, userId, userName } = data;

        console.log(`${userName || userId} started typing to ${recipientId}`);

        // Validate data
        if (!recipientId || !userId) {
            console.warn("Invalid typing-start data:", data);
            return;
        }

        // Track typing state
        if (!activeTypers.has(userId)) {
            activeTypers.set(userId, new Set());
        }
        activeTypers.get(userId).add(recipientId);

        // Get recipient's socket ID
        const recipientSocketId = userSocketMap[recipientId];

        if (recipientSocketId) {
            // Emit typing event to recipient
            io.to(recipientSocketId).emit("user-typing", {
                userId: userId,
                userName: userName,
                timestamp: new Date(),
            });
            console.log(`Sent typing indicator from ${userId} to ${recipientId}`);
        } else {
            console.log(`Recipient ${recipientId} is not online`);
        }
    });

    // Handle typing stop
    socket.on("typing-stop", (data) => {
        const { recipientId, userId } = data;

        console.log(`${userId} stopped typing to ${recipientId}`);

        // Validate data
        if (!recipientId || !userId) {
            console.warn("Invalid typing-stop data:", data);
            return;
        }

        // Remove from typing state
        if (activeTypers.has(userId)) {
            activeTypers.get(userId).delete(recipientId);
            if (activeTypers.get(userId).size === 0) {
                activeTypers.delete(userId);
            }
        }

        // Get recipient's socket ID
        const recipientSocketId = userSocketMap[recipientId];

        if (recipientSocketId) {
            // Emit stop typing event to recipient
            io.to(recipientSocketId).emit("user-stopped-typing", {
                userId: userId,
                timestamp: new Date(),
            });
            console.log(`Sent stop typing indicator from ${userId} to ${recipientId}`);
        }
    });
};

// Cleanup typing state for disconnected user
const cleanupTypingState = (userId) => {
    if (activeTypers.has(userId)) {
        const recipientIds = activeTypers.get(userId);

        // Notify all recipients that this user stopped typing
        recipientIds.forEach((recipientId) => {
            const recipientSocketId = userSocketMap[recipientId];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit("user-stopped-typing", {
                    userId: userId,
                    timestamp: new Date(),
                });
                console.log(`Cleaned up typing state: ${userId} to ${recipientId}`);
            }
        });

        activeTypers.delete(userId);
    }
};

io.on("connection", (socket) => {
    console.log("a user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (!userId || userId === "undefined") {
        console.warn("Blocked connection: Missing or invalid userId", socket.id);
        socket.disconnect();
        return;
    }

    userSocketMap[userId] = socket.id;
    socket.userId = userId;

    console.log(`User ${userId} connected with socket ${socket.id}`);

    // Setup typing handlers for this socket
    setupTypingHandlers(socket);

    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // sending events to all clients connected.

    socket.on("disconnect", () => {
        console.log("a user disconnected", socket.id);
        if (socket.userId) {
            // Clean up typing state before removing user
            cleanupTypingState(socket.userId);

            // Remove user from online users
            delete userSocketMap[socket.userId];

            console.log(`User ${socket.userId} disconnected`);
        }
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });

    socket.on("force-stop-typing", (data) => {
        const { userId } = data;
        if (userId) {
            cleanupTypingState(userId);
        }
    });
});

setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    activeTypers.forEach((recipientIds, userId) => {
        // Check if user is still online
        if (!userSocketMap[userId]) {
            console.log(`Cleaning up stale typing state for offline user: ${userId}`);
            cleanupTypingState(userId);
        }
    });
}, 30000);

export { io, server, app };
