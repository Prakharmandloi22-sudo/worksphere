# ==============================================================================
# WorkSphere Core API - Multi-Stage Production Dockerfile (Assessment 09)
# ==============================================================================

# Stage 1: Build & TypeScript compilation
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime with non-root user
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install curl for healthcheck
RUN apk add --no-cache curl

# Security: Non-root execution
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --only=production

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node src/db/schema.sql ./dist/db/schema.sql
COPY --chown=node:node src/docs/openapi.json ./dist/docs/openapi.json

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health/live || exit 1

CMD ["node", "dist/server.js"]

