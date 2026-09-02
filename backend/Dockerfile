FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app /app

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
