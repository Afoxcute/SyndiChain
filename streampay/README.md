# SyndiChain — streampay

Next.js 14 frontend + keeper bot for the SyndiChain multi-agent treasury system. Runs standalone (`output: 'standalone'`), containerized via Docker with a co-located Redis instance.

## Development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

`npm run dev` starts **both** Next.js and the keeper bot via `concurrently`:
- Next.js at [http://localhost:3000](http://localhost:3000)
- Keeper bot polling Somnia every 10 seconds

To run Next.js only:
```bash
npm run dev:next
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js + keeper bot (concurrently) |
| `npm run dev:next` | Next.js only |
| `npm run build` | Next.js production build (standalone output) |
| `npm run keeper` | Keeper bot only (ts-node) |
| `npm run lint` | ESLint |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# LLM — Qwen is primary for all 5 agents + AI stream features + keeper optimizer
QWEN_API_KEY=
ANTHROPIC_API_KEY=         # fallback only

# On-chain contracts (Somnia Testnet — already deployed, addresses pre-filled in .env.example)
NEXT_PUBLIC_TREASURY_POLICY_ADDRESS=
NEXT_PUBLIC_RISK_ORACLE_ADDRESS=
NEXT_PUBLIC_STREAM_PAY_ADDRESS=
NEXT_PUBLIC_STREAM_KEEPER_ADDRESS=
NEXT_PUBLIC_STREAM_FACTORY_ADDRESS=

# Keeper bot signs approved transactions + calls batchUpdateStreams every 10s
KEEPER_PRIVATE_KEY=

# Redis — persists swarm sessions across restarts (optional locally)
REDIS_URL=redis://localhost:6379

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Somnia Agent Kit
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
AGENT_REGISTRY_ADDRESS=
AGENT_EXECUTOR_ADDRESS=
```

## Project Layout

```
streampay/
├── app/
│   ├── page.tsx                   # Landing page
│   ├── war-room/page.tsx          # Live swarm dashboard
│   ├── benchmark/page.tsx         # Swarm vs single-agent comparison
│   ├── create/page.tsx            # AI stream creation
│   ├── streams/page.tsx           # Withdraw / cancel streams
│   ├── analytics/page.tsx         # Session analytics
│   └── api/
│       ├── swarm/route.ts         # Session orchestration + human decisions
│       ├── benchmark/             # Benchmark runner + aggregate stats
│       ├── parse-stream/          # Qwen AI stream parser
│       └── check-fraud/           # Qwen fraud detection
├── keeper/
│   ├── intelligent-keeper.ts      # Calls batchUpdateStreams every 10s
│   └── batch-optimizer.ts         # Qwen-Turbo batch scheduler
├── lib/agents/
│   ├── types.ts                   # SwarmSession, AgentMessage types
│   ├── store.ts                   # Redis session store (ioredis)
│   ├── swarm.ts                   # Orchestration — persists to Redis after every step
│   ├── manager.ts                 # Qwen-Plus decomposition + debate
│   ├── analyst.ts                 # DEX API fetcher + Qwen-Turbo pool ranker
│   ├── risk.ts                    # Risk scoring + veto
│   ├── execution.ts               # Multicall3 encoder
│   ├── compliance.ts              # TreasuryPolicy.sol rules engine
│   ├── onchain.ts                 # Raw eth_call for contract reads
│   ├── submit.ts                  # viem wallet client — broadcasts tx
│   ├── llm.ts                     # Unified Qwen/Claude client
│   └── uid.ts                     # Local nanoid
├── lib/
│   ├── contracts.ts               # Addresses + Somnia chain config
│   ├── abis/                      # Contract ABIs
│   └── pino-stub.js               # Browser no-op for WalletConnect pino
├── components/layout/Header.tsx   # Navigation header
├── hooks/
│   ├── useStreamContract.ts       # Stream wagmi hooks
│   └── useTemplates.ts            # Stream template hooks
├── public/                        # Static assets
├── docker-entrypoint.sh           # Starts keeper + Next.js in container
├── tsconfig.keeper.json           # Compiles keeper → CommonJS for plain node
└── next.config.js                 # standalone, webpack aliases, ioredis external
```

## Keeper Bot

`keeper/intelligent-keeper.ts` polls on-chain every 10 seconds and calls `batchUpdateStreams()` on `StreamPay.sol`. This is required because `StreamPay.sol` stores `realTimeBalance` in contract storage — without the keeper, withdraw transactions revert even when the UI shows a balance.

In development: keeper starts automatically with `npm run dev`.

In Docker: `docker-entrypoint.sh` starts the compiled keeper as a background process before handing PID 1 to Next.js.

**The keeper wallet (`KEEPER_PRIVATE_KEY`) needs testnet STT for gas.** Get it from the [Somnia faucet](https://testnet.somnia.network).

## Redis Session Store

`lib/agents/store.ts` provides an ioredis-backed session store:

- `saveSession(session)` — writes to Redis with 24h TTL
- `loadSession(id)` — reads by session ID
- `loadAllSessions()` — bulk read via pipeline

`swarm.ts` uses a hybrid store: in-memory Map for active in-flight sessions (no Redis latency per message push), plus `saveSession()` called after every agent step. On cold start, `getSession()` checks Redis as a fallback — sessions survive server restarts.

If `REDIS_URL` is not set, the store silently no-ops and sessions exist only in memory.

## Docker

The container is built by the root `Dockerfile` (multi-stage):

1. **base** — `npm ci` → `next build` → `tsc --project tsconfig.keeper.json`
2. **runner** — copies standalone output + static + public + keeper-dist + ioredis deps

`ioredis` is a webpack external (it has native bindings Next.js can't bundle), so it and its peer dependencies (`@ioredis`, `cluster-key-slot`, `denque`) are explicitly copied into `standalone/node_modules/` in the Dockerfile.

For production, run via `docker compose` from the repo root — this starts Redis first, waits for it to be healthy, then starts the app with `REDIS_URL=redis://redis:6379` injected automatically.

## Key Technical Notes

**`next.config.js` externals**
```js
config.externals.push('lokijs', 'encoding', 'somnia-agent-kit', 'ioredis');
```
`somnia-agent-kit` spawns worker threads that webpack can't bundle. `ioredis` has native bindings. Both resolve from `node_modules` at runtime on the server.

**`tsconfig.keeper.json`**
Separate tsconfig with `"module": "CommonJS"` — compiles keeper to `keeper-dist/` so it runs with plain `node` in production (no ts-node, no ESM).

**`submit.ts` gas pricing**
viem v2 requires a discriminated union — `maxFeePerGas` and `gasPrice` cannot both be optional in the same `sendTransaction` call. Uses an explicit branch:
```typescript
type GasPricing =
  | { maxFeePerGas: bigint; gasPrice?: undefined }
  | { gasPrice: bigint; maxFeePerGas?: undefined };
```

**`intelligent-keeper.ts` viem types**
`readContract` is cast to `Function` to bypass the EIP-7702 `authorizationList` union type added in viem v2.19+. `writeContract` explicitly passes `chain: somniaTestnet` (required in viem v2).

**`batch-optimizer.ts`**
Uses Qwen-Turbo via DashScope (`dashscope-intl.aliyuncs.com/compatible-mode/v1`). Three-tier fallback: Qwen-Turbo → error fallback (always execute) → no-API-key mode (always execute). Gemini has been fully removed.
