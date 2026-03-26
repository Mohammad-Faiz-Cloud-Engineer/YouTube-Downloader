# YouTube Downloader - Production Dockerfile
# Multi-stage build for optimized image size and security

# Stage 1: Base image with system dependencies
FROM node:18-alpine AS base

# Install FFmpeg and other required system dependencies
# FFmpeg is CRITICAL for high-quality video downloads
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    && rm -rf /var/cache/apk/*

# Stage 2: Dependencies installation
FROM base AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 3: Production image
FROM base AS production

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DOWNLOADS_DIR=/app/downloads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs package*.json ./

# Create downloads directory with proper permissions
RUN mkdir -p downloads && \
    chown -R nodejs:nodejs downloads && \
    chmod 755 downloads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
