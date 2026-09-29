# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build the Next.js app ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry by default — disable it during build
ENV NEXT_TELEMETRY_DISABLED=1

# next.config.ts sets output: "standalone", so the build is self-contained.
# src/lib/env.ts throws at import if DATABASE_URL is unset, and Next imports
# route modules while collecting page data. The postgres client connects
# lazily, so a placeholder scoped to this RUN is enough � it isn't baked into
# the image; the real value is supplied at runtime.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

# ── Stage 3 (optional): one-shot DB migrator ──
# Build/run with `--target migrator` (or the `migrate` compose service).
# Uses the full node_modules because migrate.ts needs tsx + drizzle's migrator.
FROM builder AS migrator
CMD ["npx", "tsx", "src/db/migrate.ts"]

# ── Stage 4: Production runner (default target) ──
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what the standalone build needs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Read from disk at runtime via process.cwd() (src/lib/records/pdf.ts), which
# standalone file tracing can't see
COPY --from=builder /app/src/lib/records/fonts ./src/lib/records/fonts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
