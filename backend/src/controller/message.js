import User from "../models/user.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import ErrorWrapper from "../utils/ErrorWrapper.js";
import Message from "./../models/message.js";
import { io, getReceiverSocketId } from "./../utils/socket.js";
import { getMessagesService, sendMessageService } from "../services/messageService.js";

export const getUsers = ErrorWrapper(async (req, res, next) => {
    try {
        const meAndOnlyMe = req.user._id;
        const filteredUser = await User.find({ _id: { $ne: meAndOnlyMe } }).select(
            "-password -refreshToken -__v -createdAt -updatedAt"
        );
        res.status(200).json({
            message: "Users fetched successfully",
            users: filteredUser,
            success: true,
        });
    } catch (error) {
        throw new ErrorHandler(500, "Can't fetch the users (Internal Server Error)", [error.message]);
    }
});

export const getMessages = ErrorWrapper(async (req, res, next) => {
    try {
        const { id: receiverId } = req.params;
        const { cursor, limit } = req.query;
        
        if (!receiverId) throw new ErrorHandler(400, "User id is required");
        
        const myId = req.user._id;
        const messages = await getMessagesService(myId, receiverId, cursor, parseInt(limit) || 50);

        res.status(200).json({
            message: "Messages fetched successfully",
            messages: messages, // fixed typo from original where key was `message: messages`
            success: true,
        });
    } catch (error) {
        throw new ErrorHandler(500, "Can't fetch messages", [error.message]);
    }
});

export const postSendMessage = ErrorWrapper(async (req, res, next) => {
    try {
        const { id: receiverId } = req.params;
        if (!receiverId) throw new ErrorHandler(400, "User id is required");

        const senderId = req.user._id;
        const { text } = req.body;

        const result = await sendMessageService(senderId, receiverId, text, req.files);

        if (result.queued) {
            return res.status(202).json({
                message: "Media upload queued successfully. It will be sent shortly.",
                success: true,
            });
        }

        // If it was just text, it's saved immediately
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", result);
        }

        res.status(201).json({
            message: "Message sent successfully",
            messageData: result,
            success: true,
        });
    } catch (error) {
        throw new ErrorHandler(500, "Can't send message", [error.message]);
    }
});

export const postReactToMessage = ErrorWrapper(async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) throw new ErrorHandler(404, "Message not found");

    const existingReaction = message.reactions.find((r) => r.userId.toString() === userId.toString());

    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId.toString());
        } else {
            existingReaction.emoji = emoji;
        }
    } else {
        message.reactions.push({ emoji, userId });
    }

    await message.save();

    const senderSocket = getReceiverSocketId(message.senderId.toString());
    const receiverSocket = getReceiverSocketId(message.receiverId.toString());

    if (senderSocket) io.to(senderSocket).emit("messageReaction", message);
    if (receiverSocket) io.to(receiverSocket).emit("messageReaction", message);

    res.status(200).json(message);
});

export const deleteMessage = ErrorWrapper(async (req, res) => {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) throw new ErrorHandler(404, "Message not found");

    await message.deleteOne();
    res.status(200).json({ message: "Message deleted" });
});
