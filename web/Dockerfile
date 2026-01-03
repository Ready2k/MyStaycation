# Multi-stage Dockerfile for Next.js frontend
# Compatible with Synology NAS (x86_64/amd64)

# Stage 1: Dependencies
FROM --platform=linux/amd64 node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM --platform=linux/amd64 node:20-alpine AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: Development
FROM --platform=linux/amd64 node:20-alpine AS development

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Stage 4: Production
FROM --platform=linux/amd64 node:20-alpine AS production

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

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
