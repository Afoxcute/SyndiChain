FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (layer-cached until lockfile changes)
COPY streampay/package.json streampay/package-lock.json ./

RUN npm ci

COPY streampay/ .

# ── Build-time env vars ───────────────────────────────────────────────────────
ENV NEXT_PUBLIC_TREASURY_POLICY_ADDRESS=0x2e42ffe3c108ff1c0e0f4e70cc3e36092b068c6e
ENV NEXT_PUBLIC_RISK_ORACLE_ADDRESS=0xb3242569cd189b2e4e8949388d4b7c12000f5476
ENV NEXT_PUBLIC_STREAM_PAY_ADDRESS=0x434ad66b34abe01c91eef1d24a1f2efede12c194
ENV NEXT_PUBLIC_STREAM_KEEPER_ADDRESS=0xb6b76f3c8fa04300e9564f65dc75165ba8ff44ba
ENV NEXT_PUBLIC_STREAM_FACTORY_ADDRESS=0x0781293537e5bb80f23dee95f095d8e94a6537d8
ENV SOMNIA_RPC_URL=https://dream-rpc.somnia.network
ENV AGENT_REGISTRY_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
ENV AGENT_EXECUTOR_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
ENV NEXT_PUBLIC_APP_URL=__SYNDICHAIN_APP_URL__
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=__SYNDICHAIN_WC_ID__

# Ensure public/ exists so the COPY in the runner stage never fails
RUN mkdir -p public

# Build Next.js app
RUN npm run build

# Compile keeper TypeScript → CommonJS so it runs with plain node in production
RUN npx tsc --project tsconfig.keeper.json

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_STREAM_PAY_ADDRESS=0x434ad66b34abe01c91eef1d24a1f2efede12c194
ENV SOMNIA_RPC_URL=https://dream-rpc.somnia.network

RUN groupadd --system nodejs && useradd --system --gid nodejs nextjs

# Next.js standalone output
COPY --from=base --chown=nextjs:nodejs /app/.next/standalone/    ./standalone/
COPY --from=base --chown=nextjs:nodejs /app/.next/static/        ./standalone/.next/static/
COPY --from=base --chown=nextjs:nodejs /app/public/              ./standalone/public/

# ioredis is marked as a webpack external so Next.js doesn't bundle it.
# We must copy it (and its deps) into standalone/node_modules manually
# so Node.js can resolve it at runtime.
COPY --from=base --chown=nextjs:nodejs /app/node_modules/ioredis              ./standalone/node_modules/ioredis/
COPY --from=base --chown=nextjs:nodejs /app/node_modules/@ioredis             ./standalone/node_modules/@ioredis/
COPY --from=base --chown=nextjs:nodejs /app/node_modules/cluster-key-slot     ./standalone/node_modules/cluster-key-slot/
COPY --from=base --chown=nextjs:nodejs /app/node_modules/denque               ./standalone/node_modules/denque/

# Compiled keeper + full node_modules for its runtime dependencies
COPY --from=base --chown=nextjs:nodejs /app/keeper-dist/         ./keeper-dist/
COPY --from=base --chown=nextjs:nodejs /app/node_modules/        ./node_modules/

COPY --from=base --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
