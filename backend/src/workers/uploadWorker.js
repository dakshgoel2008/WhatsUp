import { Worker } from "bullmq";
import uploadOnCloudinary from "../utils/cloudinary.js";
import Message from "../models/message.js";
import { io, getReceiverSocketId } from "../utils/socket.js";
import { redisAvailable } from "../utils/redisClient.js";
import IORedis from "ioredis";

// BullMQ requires ioredis instead of standard redis client
let uploadQueue = null;
let uploadWorker = null;

const setupUploadWorker = async () => {
    if (!redisAvailable) {
        console.warn("⚠️ Upload worker disabled (no Redis). File uploads will fail until Redis is available.");
        return;
    }

    try {
        const { Queue } = await import("bullmq");
        const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });

        uploadQueue = new Queue("uploadQueue", { connection });

        // Setup Worker
        uploadWorker = new Worker(
            "uploadQueue",
            async (job) => {
                const { senderId, receiverId, text, fileBuffer, fileType, originalName, resourceType, folder } = job.data;

                console.log(`[Worker] Processing upload job ${job.id} for ${originalName}`);

                try {
                    // Buffer comes as JSON from redis, need to convert back to Buffer
                    const buffer = Buffer.from(fileBuffer.data);

                    const result = await uploadOnCloudinary(buffer, {
                        resource_type: resourceType,
                        folder: folder,
                    });

                    const messageData = {
                        senderId,
                        receiverId,
                        text,
                    };

                    if (fileType === "image") messageData.image = result.secure_url;
                    else if (fileType === "video") messageData.video = result.secure_url;
                    else if (fileType === "audio") messageData.audio = result.secure_url;
                    else messageData.file = result.secure_url;

                    const message = await Message.create(messageData);

                    // Notify receiver if online
                    const receiverSocketId = getReceiverSocketId(receiverId);
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newMessage", message);
                    }

                    // Notify sender that upload is done (for their own UI update)
                    const senderSocketId = getReceiverSocketId(senderId);
                    if (senderSocketId) {
                        io.to(senderSocketId).emit("messageUploaded", message);
                    }

                    console.log(`[Worker] Job ${job.id} completed successfully`);
                    return message;
                } catch (error) {
                    console.error(`[Worker] Job ${job.id} failed:`, error);
                    throw error;
                }
            },
            { connection },
        );

        uploadWorker.on("failed", (job, err) => {
            console.error(`Job ${job.id} failed with error ${err.message}`);
        });

        console.log("✅ Upload worker initialized");
    } catch (err) {
        console.warn("⚠️ Failed to setup upload worker:", err.message);
    }
};

// Initialize worker
setupUploadWorker();

export { uploadQueue };
