# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Prune monorepo for check-printing-backend
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.10.12
COPY . .
RUN turbo prune @smartbusiness/check-printing-backend --docker

# Stage 3: Install dependencies and compile
FROM base AS builder
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Generate Prisma 7 Client in @smartbusiness/database
RUN pnpm --filter @smartbusiness/database generate
RUN pnpm --filter @smartbusiness/database build
RUN pnpm --filter @smartbusiness/auth build
RUN pnpm --filter @smartbusiness/jobs build 2>/dev/null || true
RUN pnpm --filter @smartbusiness/email build 2>/dev/null || true

# Build check-printing-backend
RUN pnpm --filter @smartbusiness/check-printing-backend build

# Stage 4: Production Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 smartbusiness

# Copy compiled files, node_modules and dependencies
COPY --from=builder --chown=smartbusiness:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=smartbusiness:nodejs /app/packages ./packages
COPY --from=builder --chown=smartbusiness:nodejs /app/apps/check-printing-backend ./apps/check-printing-backend
COPY --from=builder --chown=smartbusiness:nodejs /app/package.json ./package.json

USER smartbusiness
WORKDIR /app/apps/check-printing-backend
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3005/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
