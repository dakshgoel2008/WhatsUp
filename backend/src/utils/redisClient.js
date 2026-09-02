import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({ url: redisUrl });
export const pubClient = createClient({ url: redisUrl });
export const subClient = createClient({ url: redisUrl });

redisClient.on("error", (err) => console.error("Redis Client Error", err));
pubClient.on("error", (err) => console.error("Redis Pub Client Error", err));
subClient.on("error", (err) => console.error("Redis Sub Client Error", err));

export const connectRedis = async () => {
    if (!redisClient.isOpen) await redisClient.connect();
    if (!pubClient.isOpen) await pubClient.connect();
    if (!subClient.isOpen) await subClient.connect();
};

export default redisClient;
