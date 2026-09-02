import { create } from "zustand";
import { axiosInstance } from "./../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

let socketUrl = import.meta.env.VITE_API_BASE_URL;
if (!socketUrl || socketUrl === "undefined") {
    socketUrl = import.meta.env.MODE === "development" ? "http://localhost:4444" : "/";
}

export const useUserAuthStore = create((set, get) => ({
    isLoggingIn: false,
    isSigningUp: false,
    isCheckingAuth: true,
    isUpdatingProfile: false,
    isUpdatingPassword: false,
    user: null,
    onlineUsers: [],
    socket: null,
    isLoggedIn: false,
    isDeletingAccount: false,

    logoutSuccess: false,
    signupSuccess: false,
    passwordUpdateSuccess: false,
    deleteAccountSuccess: false,

    checkAuth: async () => {
        set({ isCheckingAuth: true });
        try {
            const accessToken = localStorage.getItem("accessToken");
            const refreshToken = localStorage.getItem("refreshToken");

            if (!accessToken || !refreshToken) {
                console.log("No tokens found, skipping auth check");
                set({ user: null, isLoggedIn: false, isCheckingAuth: false });
                return;
            }

            const res = await axiosInstance.get("/auth/check");
            set({ user: res.data, isLoggedIn: !!res.data });
            setTimeout(() => get().connectSocket(), 100);
        } catch (err) {
            console.error("Auth check failed:", err);
            set({ user: null, isLoggedIn: false });
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    signUp: async (data) => {
        set({ isSigningUp: true, signupSuccess: false });
        try {
            const res = await axiosInstance.post("/auth/signup", data);
            toast.success("Signed up successfully! Please log in.");

            set({ signupSuccess: true });
        } catch (err) {
            console.error("Signup error:", err);
            toast.error(err?.response?.data?.message || "Signup failed. Please try again.");
        } finally {
            set({ isSigningUp: false });
        }
    },

    logIn: async (data) => {
        set({ isLoggingIn: true });
        try {
            const res = await axiosInstance.post("/auth/login", data);
            const { user, accessToken, refreshToken } = res.data;

            if (accessToken) {
                localStorage.setItem("accessToken", accessToken);
            }
            if (refreshToken) {
                localStorage.setItem("refreshToken", refreshToken);
            }

            set({ user: user, isLoggedIn: true });
            toast.success("Logged in successfully");
            setTimeout(() => get().connectSocket(), 100);
        } catch (err) {
            console.error("Login error:", err);
            toast.error(err?.response?.data?.message || "Login failed. Please try again.");
            set({ user: null, isLoggedIn: false });
        } finally {
            set({ isLoggingIn: false });
        }
    },

    logOut: async () => {
        set({ logoutSuccess: false });
        try {
            get().disconnectSocket();
            await axiosInstance.post("/auth/logout");

            set({ user: null, isLoggedIn: false, onlineUsers: [] });
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            toast.success("Logged out successfully");

            set({ logoutSuccess: true });
        } catch (err) {
            console.error("Logout error:", err);
            get().disconnectSocket();
            set({ user: null, isLoggedIn: false, onlineUsers: [] });
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            toast.error(err?.response?.data?.message || "Logout failed");

            set({ logoutSuccess: true });
        }
    },

    updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
            const res = await axiosInstance.put("/auth/update-profile", data);
            const updatedUser = res.data.user;
            set({ user: updatedUser });
            toast.success("Profile updated successfully");
        } catch (err) {
            console.error("Update Profile error:", err);
            toast.error(err?.response?.data?.message || "Update Profile failed. Please try again.");
        } finally {
            set({ isUpdatingProfile: false });
        }
    },

    updatePassword: async (data) => {
        set({ isUpdatingPassword: true, passwordUpdateSuccess: false });
        try {
            const res = await axiosInstance.put("/auth/update-password", data);
            toast.success("Password updated successfully! Please log in again.");

            get().disconnectSocket();
            set({ user: null, isLoggedIn: false });
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            set({ passwordUpdateSuccess: true });
        } catch (err) {
            console.error("Update Password error:", err);
            toast.error(err?.response?.data?.message || "Update Password failed. Please try again.");
        } finally {
            set({ isUpdatingPassword: false });
        }
    },

    deleteAccount: async (data = {}) => {
        set({ isDeletingAccount: true, deleteAccountSuccess: false });
        try {
            get().disconnectSocket();
            await axiosInstance.post("/auth/delete-account", data);

            set({ user: null, isLoggedIn: false, onlineUsers: [] });
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            toast.success("Account deleted successfully");

            set({ deleteAccountSuccess: true });
        } catch (err) {
            console.error("Delete Account error:", err);
            let errorMessage = "Delete Account failed. Please try again.";
            if (err?.response?.status === 401) {
                errorMessage = "Incorrect password";
            } else if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            }
            toast.error(errorMessage);
            throw err;
        } finally {
            set({ isDeletingAccount: false });
        }
    },

    resetSignupSuccess: () => set({ signupSuccess: false }),
    resetLogoutSuccess: () => set({ logoutSuccess: false }),
    resetPasswordUpdateSuccess: () => set({ passwordUpdateSuccess: false }),
    resetDeleteAccountSuccess: () => set({ deleteAccountSuccess: false }),

    connectSocket: () => {
        const { user, socket: currentSocket } = get();

        if (!user || !user._id) {
            console.log("connectSocket: No user or user._id found, skipping connection.");
            return;
        }

        if (currentSocket?.connected) {
            console.log("connectSocket: Socket already connected.");
            return;
        }

        if (currentSocket && !currentSocket.connected) {
            console.log("connectSocket: Cleaning up old socket connection.");
            currentSocket.removeAllListeners();
            currentSocket.disconnect();
            set({ socket: null });
        }

        console.log(`connectSocket: Attempting to connect for user ${user._id}`);

        const newSocket = io(socketUrl, {
            query: { userId: user._id },
            transports: ["websocket", "polling"],
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            timeout: 10000,
        });

        newSocket.on("connect", () => {
            console.log("Socket connected:", newSocket.id);
            toast.success("Real-time connection established!");
        });

        newSocket.on("getOnlineUsers", (users) => {
            console.log("Online Users:", users);
            set({ onlineUsers: users });
        });

        newSocket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
            toast.error(`Connection failed: ${err.message}`);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
            if (reason !== "io client disconnect") {
                toast.error("Connection lost. Reconnecting...");
            }
            set({ onlineUsers: [] });
        });

        set({ socket: newSocket });
    },

    disconnectSocket: () => {
        const socket = get().socket;
        if (socket) {
            console.log("Disconnecting socket...");
            socket.removeAllListeners();
            socket.disconnect();
            set({ socket: null, onlineUsers: [] });
        }
    },
}));
