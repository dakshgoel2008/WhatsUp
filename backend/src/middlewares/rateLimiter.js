import rateLimit from "express-rate-limit";
import { redisAvailable } from "../utils/redisClient.js";

// Build Redis store only if Redis is available
let apiStore = undefined; // undefined = use default in-memory store
let authStore = undefined;

if (redisAvailable) {
    try {
        const { RedisStore } = await import("rate-limit-redis");
        const IORedis = (await import("ioredis")).default;
        const redisClient = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Don't retry
        });

        apiStore = new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
            prefix: "rl:api:",
        });
        authStore = new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
            prefix: "rl:auth:",
        });
        console.log("✅ Rate limiter using Redis store");
    } catch (err) {
        console.warn("⚠️ Failed to setup Redis rate limiter store:", err.message);
        console.warn("⚠️ Falling back to in-memory rate limiter");
    }
} else {
    console.warn("⚠️ Rate limiter using in-memory store (no Redis)");
}

// General API rate limiting
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    ...(apiStore && { store: apiStore }),
    message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes" },
});

// Stricter rate limiting for auth routes
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    ...(authStore && { store: authStore }),
    message: { success: false, message: "Too many auth attempts from this IP, please try again after an hour" },
});
