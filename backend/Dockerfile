# Multi-stage Dockerfile for backend API and worker
# Compatible with Synology NAS (x86_64/amd64)

# Stage 1: Base dependencies
FROM --platform=linux/amd64 node:20-alpine AS base

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Stage 2: Dependencies installation
FROM base AS dependencies

# Copy source code FIRST (before npm install)
COPY . .

# Install dependencies (this will compile native modules for x86_64)
RUN npm install --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm install

# Stage 3: Build
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 4: Development
FROM base AS development

# Copy source code FIRST
COPY . .

# Install dependencies (compiles native modules for x86_64)
RUN npm install

EXPOSE 4000

CMD ["npm", "run", "dev"]

# Stage 5: Production
FROM --platform=linux/amd64 node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=dependencies /prod_node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Set Playwright to use system chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER nodejs

EXPOSE 4000

CMD ["node", "dist/index.js"]
