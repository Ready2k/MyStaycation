# Multi-stage Dockerfile for Next.js frontend
# Target platform (linux/amd64) is set by the buildx --platform flag at build time.

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./

# --legacy-peer-deps: avoids peer-dep conflicts from transitive packages.
RUN npm ci --legacy-peer-deps

# Stage 2: Build
FROM node:20-alpine AS build

WORKDIR /app

# Build-time version info — passed from push-images.sh via --build-arg
ARG NEXT_PUBLIC_BUILD_TIME
ARG NEXT_PUBLIC_BUILD_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME
ENV NEXT_PUBLIC_BUILD_SHA=$NEXT_PUBLIC_BUILD_SHA

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: Development
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Stage 4: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
