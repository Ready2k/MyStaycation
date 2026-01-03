FROM node:20-alpine AS base

WORKDIR /app

# Development
FROM base AS development

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Build
FROM base AS build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
