# Chatting-Application

A production-ready, highly scalable MERN-based real-time chatting web application with a clean and responsive UI.

## 🚀 Advanced Architecture & Features

This project was built to demonstrate enterprise-grade engineering practices:
- **Containerized Deployment**: Fully Dockerized infrastructure (MongoDB, Redis, Node Backend, React Frontend) orchestrated via `docker-compose`.
- **Background Jobs (BullMQ)**: Media uploads (images, videos, audio) are offloaded to a Redis-backed queue to ensure the main event loop is never blocked.
- **Horizontal Scalability**: Implemented `@socket.io/redis-adapter` allowing WebSocket connections to scale across multiple Node instances.
- **Optimized Data Fetching**: Cursor-based pagination with infinite scrolling for fetching chat history seamlessly.
- **Robust Security**: Strict API payload validation using `Zod` and IP-based rate limiting via `express-rate-limit` using a Redis store.

## 🛠️ Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Zustand (State Management)
- **Backend**: Node.js, Express.js, Socket.IO
- **Database & Cache**: MongoDB, Redis, BullMQ (Task Queue)
- **DevOps**: Docker, Docker Compose

## 🚀 How to Run Locally

Since the entire application is Dockerized, you can spin up the entire stack with a single command!

1. Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
2. Ensure you have created a `.env` file inside the `backend/` directory with your secrets (like MongoDB URI, Cloudinary keys, JWT Secrets).
3. Open a terminal in the root folder and run:
   ```bash
   docker-compose up --build
   ```
4. Once the containers are running, open your browser and navigate to:
   **http://localhost:3000**
