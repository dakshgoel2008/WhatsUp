import mongoose, { Schema } from "mongoose";
const messageSchema = new Schema(
    {
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // types of files available to be sent
        text: {
            type: String,
            required: false,
            trim: false,
        },
        image: {
            type: String,
            required: false,
        },
        video: {
            type: String,
            required: false,
        },
        audio: {
            type: String,
            required: false,
        },
        file: {
            type: String,
            required: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        isDeletedBySender: {
            type: Boolean,
            default: false,
        },
        isDeletedByReceiver: {
            type: Boolean,
            default: false,
        },
        isDeletedByBoth: {
            type: Boolean,
            default: false,
        },
        reactions: [
            {
                emoji: String,
                userId: { type: Schema.Types.ObjectId, ref: "User" },
            },
        ],
    },
    {
        timestamps: true, // Enable timestamps
    }
);

// Indexes for fast fetching of messages between two users and cursor pagination
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
