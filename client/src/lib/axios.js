import axios from "axios";
import toast from "react-hot-toast";

let apiUrl = import.meta.env.VITE_API_BASE_URL;
if (!apiUrl || apiUrl === "undefined") apiUrl = "";

export const axiosInstance = axios.create({
    baseURL: `${apiUrl}/api`,
    withCredentials: true,
});

// Request interceptor - add tokens to requests
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (refreshToken) {
            config.headers["x-refresh-token"] = refreshToken;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let sessionExpiredFlag = false;

export const getSessionExpiredFlag = () => sessionExpiredFlag;
export const resetSessionExpiredFlag = () => {
    sessionExpiredFlag = false;
};

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const publicEndpoints = ["/auth/login", "/auth/signup", "/auth/check"];
        const isPublicEndpoint = publicEndpoints.some((endpoint) => originalRequest?.url?.includes(endpoint));

        if (error.response?.status === 401 && !originalRequest._retry && !isPublicEndpoint) {
            originalRequest._retry = true;

            // Clear tokens
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            if (!sessionExpiredFlag) {
                sessionExpiredFlag = true;
                toast.error("Session expired. Please login again.");
            }
        }

        return Promise.reject(error);
    }
);
