# Multi-stage Dockerfile for backend API and worker
# Compatible with Synology NAS (x86_64/amd64)
#
# Build stages (Alpine) handle TypeScript compilation.
# Production stage uses node:20-slim (Debian/glibc) so that
# Playwright's bundled Chromium works — it requires glibc, not Alpine's musl.

# Stage 1: Base — Alpine, used only for compilation
FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Stage 2: Install dependencies (Alpine — dev + prod, for TypeScript build)
FROM base AS dependencies

COPY . .

RUN npm install --omit=dev --legacy-peer-deps && \
    cp -R node_modules /prod_node_modules && \
    npm install --legacy-peer-deps

# Stage 3: Build TypeScript (Alpine)
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 4: Development (Alpine — runs locally, not on Synology)
FROM base AS development

COPY . .

RUN npm install --legacy-peer-deps

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 4000

CMD ["npm", "run", "dev"]

# Stage 5: Production — Debian slim (glibc) for Playwright Chromium compatibility
FROM node:20-slim AS production

WORKDIR /app

# Install system libs required by Playwright's Chromium + build tools for native npm modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    libnss3 \
    libfreetype6 \
    libharfbuzz0b \
    ca-certificates \
    fonts-freefont-ttf \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nodejs

# Reinstall production deps compiled for glibc (Alpine-compiled modules won't work here)
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist

# Install Playwright's own Chromium build to a fixed path (as root before USER switch)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium && \
    chmod -R o+rx /ms-playwright

USER nodejs

EXPOSE 4000

CMD ["node", "dist/index.js"]
