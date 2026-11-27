# Build the SPA and bundle the Express/TypeScript entry point.
FROM oven/bun:1.2.10-alpine AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ENV NODE_ENV=production
RUN bun run build

# Runtime dependencies only.
FROM oven/bun:1.2.10-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOME=/tmp TMPDIR=/tmp BUN_INSTALL_CACHE_DIR=/tmp/bun-cache
RUN apk add --no-cache curl
COPY package.json ./
COPY --from=build /app/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production && bun pm cache rm
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["bun", "run", "dist/server.cjs"]
