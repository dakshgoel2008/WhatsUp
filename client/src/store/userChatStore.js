import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useUserAuthStore } from "./userAuthStore";

export const useUserChatStore = create((set, get) => ({
    message: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessageLoading: false,
    starredChats: [],
    archivedChats: [],

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/message/users");
            set({ users: res.data.users });
        } catch (err) {
            console.error("Get users error:", err);
            toast.error(err?.response?.data?.message || err?.message || "Get users failed. Please try again.");
        } finally {
            set({ isUsersLoading: false });
        }
    },

    getMessages: async (userId, cursor = null) => {
        if (!cursor) set({ isMessageLoading: true });
        try {
            const url = cursor ? `/message/${userId}?cursor=${cursor}` : `/message/${userId}`;
            const res = await axiosInstance.get(url);
            if (cursor) {
                set(state => ({ message: [...res.data.messages, ...state.message] }));
            } else {
                set({ message: res.data.messages });
            }
        } catch (err) {
            console.error("Get messages error:", err);
            toast.error(err?.response?.data?.message || err?.message || "Get messages failed. Please try again.");
        } finally {
            if (!cursor) set({ isMessageLoading: false });
        }
    },

    sendMessage: async (data) => {
        const { selectedUser, message } = get();
        try {
            const res = await axiosInstance.post(`/message/send/${selectedUser._id}`, data);
            set({ message: [...message, res.data.message] });
        } catch (error) {
            console.error("Send message error:", error);
            toast.error(error?.response?.data?.message || error?.message || "Send message failed. Please try again.");
        }
    },

    reactToMessage: async (messageId, emoji) => {
        try {
            const res = await axiosInstance.post(`/message/react/${messageId}`, { emoji });
            const updatedMessage = res.data;
            set((state) => ({
                message: state.message.map((msg) => (msg._id === messageId ? updatedMessage : msg)),
            }));
        } catch (error) {
            toast.error("Failed to react to message");
        }
    },

    deleteMessage: async (messageId) => {
        try {
            await axiosInstance.delete(`/message/remove/${messageId}`);
            set((state) => ({
                message: state.message.filter((msg) => msg._id !== messageId),
            }));
            toast.success("Message deleted");
        } catch (error) {
            toast.error("Failed to delete message");
        }
    },

    subscribeToMessages: () => {
        const { selectedUser } = get();
        if (!selectedUser) return;

        const socket = useUserAuthStore.getState().socket;

        socket.on("newMessage", (newMessage) => {
            if (newMessage.senderId !== selectedUser._id) return;
            set({ message: [...get().message, newMessage] });
        });

        socket.on("messageReaction", (updatedMessage) => {
            set((state) => ({
                message: state.message.map((msg) => (msg._id === updatedMessage._id ? updatedMessage : msg)),
            }));
        });
    },

    unSubscribeToMessages: () => {
        const socket = useUserAuthStore.getState().socket;
        socket.off("newMessage");
    },

    setSelectedUser: (user) => set({ selectedUser: user }),
}));
