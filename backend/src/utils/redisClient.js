import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Track whether Redis is available
export let redisAvailable = false;

const redisClient = createClient({
    url: redisUrl,
    socket: {
        connectTimeoutMs: 5000,
        reconnectStrategy: false, // Don't auto-reconnect if initial connection fails
    },
});
export const pubClient = createClient({
    url: redisUrl,
    socket: {
        connectTimeoutMs: 5000,
        reconnectStrategy: false,
    },
});
export const subClient = createClient({
    url: redisUrl,
    socket: {
        connectTimeoutMs: 5000,
        reconnectStrategy: false,
    },
});

redisClient.on("error", (err) => console.error("⚠️ Redis Client Error:", err.message));
pubClient.on("error", (err) => console.error("⚠️ Redis Pub Client Error:", err.message));
subClient.on("error", (err) => console.error("⚠️ Redis Sub Client Error:", err.message));

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) await redisClient.connect();
        if (!pubClient.isOpen) await pubClient.connect();
        if (!subClient.isOpen) await subClient.connect();
        redisAvailable = true;
        console.log("✅ Redis connected successfully");
    } catch (err) {
        redisAvailable = false;
        console.warn("⚠️ Redis connection failed:", err.message);
        console.warn("⚠️ App will run without Redis (in-memory fallbacks will be used)");
    }
};

export default redisClient;
