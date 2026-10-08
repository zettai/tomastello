# Base image
FROM node:22-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts

# Build
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY src/ ./src/
COPY next.config.ts postcss.config.mjs tailwind.config.ts tsconfig.json ./
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs && \
    mkdir -p public && \
    mkdir .next && chown nextjs:nodejs .next && chmod 444 .next

COPY --from=builder /app/public ./public
RUN chmod -R 444 ./public

COPY --from=builder /app/.next/standalone ./
RUN chown -R nextjs:nodejs . && \
    find . -type f -exec chmod 444 {} \; && \
    find . -type d -exec chmod 555 {} \;

COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nodejs ./.next/static && \
    find ./.next/static -type f -exec chmod 444 {} \; && \
    find ./.next/static -type d -exec chmod 555 {} \;

# next/image writes optimized images here; the rest of the app stays read-only
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache && chmod 755 .next/cache

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]