import express from "express";
import path from "path";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
import helmet from "helmet";
import cors from "cors";
// Routes
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/message.js";
import { app, server } from "./utils/socket.js";
import { apiLimiter, authLimiter } from "./middlewares/rateLimiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4444;

const isProduction = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin" },
    }),
);

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://trusted.cdn.com"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    }),
);

// CORS Configuration - FIXED VERSION
const devOrigins = process.env.CORS_ORIGINS ? JSON.parse(process.env.CORS_ORIGINS) : ["http://localhost:5173"];
const prodOrigin = process.env.PRODUCTION_CLIENT_URL;

// Build allowed origins array, filtering out any undefined/null values
let allowedOrigins = [];
if (isProduction) {
    if (prodOrigin) {
        // Support multiple production origins if comma-separated
        allowedOrigins = prodOrigin.split(",").map((origin) => origin.trim());
    }
} else {
    allowedOrigins = devOrigins;
}

// Log CORS configuration on startup
console.log("🔒 CORS Configuration:");
console.log("   Environment:", isProduction ? "PRODUCTION" : "DEVELOPMENT");
console.log("   Allowed Origins:", allowedOrigins);

app.use(
    cors({
        origin: function (origin, callback) {
            console.log(`📨 Request from origin: ${origin || "NO ORIGIN HEADER"}`);

            // ✅ ADD: Log the allowed origins for debugging
            console.log(`📋 Allowed origins: ${JSON.stringify(allowedOrigins)}`);

            if (!origin) {
                console.log("✅ Allowing request with no origin header");
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                console.log(`✅ Origin ${origin} is in allowed list`);
                return callback(null, true);
            }

            console.warn(`❌ CORS BLOCKED - Origin not in allowed list: ${origin}`);
            console.warn(`📋 Allowed origins: ${JSON.stringify(allowedOrigins)}`);

            if (!isProduction) {
                console.log("⚠DEV MODE: Allowing anyway for debugging");
                return callback(null, true);
            }

            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-refresh-token"],
    }),
);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/message", apiLimiter, messageRoutes);

if (isProduction) {
    const clientBuildPath = path.join(__dirname, "..", "..", "client", "dist");
    app.use(express.static(clientBuildPath));

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(clientBuildPath, "index.html"));
    });
}

// DB Connection:
const dbPath = isProduction ? process.env.PRODUCTION_DB_PATH : process.env.DB_PATH;

if (!dbPath) {
    console.error("❌ Database connection string not found!");
    console.error("   Please set DB_PATH (dev) or PRODUCTION_DB_PATH (prod) environment variable");
    process.exit(1);
}

import { connectRedis } from "./utils/redisClient.js";
import { setupSocketRedisAdapter } from "./utils/socket.js";

// MongoDB connection with retry logic
const connectWithRetry = async (maxRetries = 5, initialDelay = 2000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 MongoDB connection attempt ${attempt}/${maxRetries}...`);
            await mongoose.connect(dbPath);
            console.log(`✅ MongoDB connected successfully`);
            console.log(`   Database: ${isProduction ? "Production" : "Development"}`);
            return true;
        } catch (err) {
            console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err.message);
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`   Retrying in ${delay / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    console.error("❌ All MongoDB connection attempts failed. The app will stay alive but DB features won't work.");
    console.error("   Please check your PRODUCTION_DB_PATH env var and MongoDB Atlas IP whitelist.");
    return false;
};

// Start server FIRST so Render detects the port, then connect to services
server.listen(PORT, async () => {
    console.log("✅ Server Started Successfully!");
    console.log(`   Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Allowed Origins: ${allowedOrigins.join(", ")}`);

    // Connect to Redis (non-blocking)
    await connectRedis();

    // Setup Socket.IO Redis adapter after Redis is connected
    await setupSocketRedisAdapter();

    // Connect to MongoDB with retries
    await connectWithRetry();
});

import "./workers/uploadWorker.js";

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Global Error:", err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || [],
    });
});

