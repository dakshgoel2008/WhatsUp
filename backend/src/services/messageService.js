import Message from "../models/message.js";
import { uploadQueue } from "../workers/uploadWorker.js";

export const getMessagesService = async (myId, receiverId, cursor, limit = 50) => {
    const query = {
        $or: [
            { senderId: myId, receiverId: receiverId },
            { senderId: receiverId, receiverId: myId },
        ],
    };

    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

    // Ensure they are sent in chronological order
    return messages.reverse();
};

export const sendMessageService = async (senderId, receiverId, text, files) => {
    if (files && files.length > 0) {
        // Background Job for media uploads
        for (const file of files) {
            const mimetype = file.mimetype.toLowerCase();
            let fileType = "file";
            let resourceType = "raw";
            let folder = "chat-files";

            if (mimetype.startsWith("image/")) {
                fileType = "image";
                resourceType = "image";
                folder = "chat-images";
            } else if (mimetype.startsWith("video/")) {
                fileType = "video";
                resourceType = "video";
                folder = "chat-videos";
            } else if (mimetype.startsWith("audio/")) {
                fileType = "audio";
                resourceType = "video";
                folder = "chat-audio";
            }

            if (!uploadQueue) {
                throw new Error("File upload service is unavailable (Redis not connected). Please try again later.");
            }
            await uploadQueue.add("upload-file", {
                senderId,
                receiverId,
                text,
                fileBuffer: { data: file.buffer.toJSON().data },
                fileType,
                originalName: file.originalname,
                resourceType,
                folder
            });
        }
        return { queued: true };
    } else {
        const message = await Message.create({ senderId, receiverId, text });
        return message;
    }
};
