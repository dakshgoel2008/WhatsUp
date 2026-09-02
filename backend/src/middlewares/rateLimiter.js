import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import IORedis from "ioredis";

const redisClient = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

// General API rate limiting
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: "rl:api:",
    }),
    message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes" },
});

// Stricter rate limiting for auth routes
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: "rl:auth:",
    }),
    message: { success: false, message: "Too many auth attempts from this IP, please try again after an hour" },
});
