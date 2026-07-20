# SyndiChain: The Multi-Agent DAO Treasury Swarm

An autonomous multi-agent AI system that manages crypto treasuries on the Somnia blockchain. Five specialized agents decompose complex goals, debate risky strategies, veto unsafe proposals, and collaboratively construct gas-optimized transactions — with a human veto at every critical step.

Built for **Somnia Hackathon — Track 3: Multi-Agent Collaboration**.

---

## Live Features

### War Room (`/war-room`)
The core experience. Enter a treasury goal in plain English — agents collaborate in real time:

1. **Manager** (Qwen-Plus) decomposes the goal into parallel sub-tasks
2. **Analyst** (Qwen-Turbo) queries Somnia Exchange + Potion Swap DEX APIs for live yield pools
3. **Risk** (Qwen-Turbo) queries `SomniaAgentRiskOracle.sol` + Shannon Explorer — vetoes anything with risk score > 70
4. **Debate protocol** — 2 rounds of LLM-powered Analyst vs Risk arguments, Manager adjudicates
5. **Human escalation** — deadlocked debates go to you with both sides presented
6. **Execution** (Qwen-Turbo) encodes a gas-optimized Multicall3 batch via Somnia Agent Kit + viem
7. **Compliance** verifies against `TreasuryPolicy.sol` — daily limits, allowlists, multisig thresholds
8. **Human approval** → transaction broadcast to Somnia via `KEEPER_PRIVATE_KEY` + viem wallet client

### Benchmark (`/benchmark`)
Aggregate stats (20 trials) + live head-to-head comparing SyndiChain vs single-agent Qwen:

| Metric | Single Agent | SyndiChain |
|--------|-------------|------------|
| Safe Tx Rate | 58% | 95% |
| Hallucination Rate | 40% | 2% |
| Risk Miss Rate | 45% | 5% |
| Avg Speed | 14.2s | 9.8s |

### Create Stream (`/create`)
Set up real-time STT payment streams:
- **AI Parse** (Qwen-Turbo) — describe stream in plain English, fields auto-filled
- **Fraud Detection** (Qwen-Turbo) — risk scores the recipient/amount before submission
- Calls `StreamPay.sol` on-chain — STT locked and released per-second to recipient

### My Streams (`/streams`)
Recipient and sender dashboard:
- Live per-second withdrawable balance ticker
- **Withdraw** button — recipients claim accumulated STT on-chain
- **Cancel** button — senders recover unstreamed funds

### Analytics (`/analytics`)
Real-time swarm session stats — agent message volume, governance outcomes, debate frequency, session history. Reads from Redis so stats survive server restarts.

---

## Agent Architecture

```
User Prompt
     │
     ▼
┌─────────────┐
│   Manager   │ ← Qwen-Plus (reasoning)
│  (Swarm HQ) │   Decomposes, mediates, escalates
└──────┬──────┘
       │ parallel
  ┌────┴────┐
  ▼         ▼
┌────────┐ ┌──────┐
│Analyst │ │ Risk │ ← Qwen-Turbo (fast workers)
│DEX APIs│ │Oracle│
└────┬───┘ └──┬───┘
     │   veto? │
     └────┬────┘
          │ debate (up to 2 rounds)
          ▼
    ┌───────────┐
    │  Manager  │ adjudicates → approve / reject / escalate to human
    └─────┬─────┘
          ▼
    ┌───────────┐
    │ Execution │ ← Qwen-Turbo + viem encodeFunctionData
    │ Multicall │   Somnia Agent Kit MultiCall SDK
    └─────┬─────┘
          ▼
    ┌────────────┐
    │ Compliance │ ← Rules engine (no LLM)
    │TreasuryPol.│   Reads TreasuryPolicy.sol on-chain
    └─────┬──────┘
          ▼
    Human Approval → broadcast via KEEPER_PRIVATE_KEY + viem
          │
          ▼
    Redis ← session persisted at every step
```

---

## Smart Contracts (Somnia Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| `TreasuryPolicy.sol` | `0x2e42ffe3c108ff1c0e0f4e70cc3e36092b068c6e` | Hard policy limits — daily caps, allowlists, multisig threshold |
| `SomniaAgentRiskOracle.sol` | `0xb3242569cd189b2e4e8949388d4b7c12000f5476` | On-chain risk registry — audit scores, TVL, exploit history |
| `StreamPay.sol` | `0x434ad66b34abe01c91eef1d24a1f2efede12c194` | Real-time STT streaming (per-second disbursement) |
| `StreamFactory.sol` | `0x0781293537e5bb80f23dee95f095d8e94a6537d8` | Stream templates |
| `StreamKeeper.sol` | `0xb6b76f3c8fa04300e9564f65dc75165ba8ff44ba` | Automated stream keeper bot |
| `Multicall3` | `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223` | Batch transaction executor |

Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)

---

## Project Structure

```
SyndiChain/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # Typecheck → Docker build/push → SSH deploy (compose)
├── Dockerfile                     # Multi-stage: Next.js standalone + compiled keeper
├── docker-compose.yml             # Production: app + Redis:7-alpine with healthcheck
├── contracts/
│   ├── contracts/
│   │   ├── TreasuryPolicy.sol
│   │   ├── SomniaAgentRiskOracle.sol
│   │   ├── StreamPay.sol
│   │   ├── StreamFactory.sol
│   │   └── StreamKeeper.sol
│   ├── scripts/deploy.ts
│   └── tsconfig.json
│
└── streampay/                     # Next.js 14 frontend + keeper bot
    ├── app/
    │   ├── page.tsx               # Landing page
    │   ├── war-room/page.tsx      # Live agent swarm dashboard
    │   ├── benchmark/page.tsx     # Swarm vs single-agent comparison
    │   ├── create/page.tsx        # AI-powered stream creation
    │   ├── streams/page.tsx       # Withdraw / cancel streams
    │   ├── analytics/page.tsx     # Swarm session analytics
    │   └── api/
    │       ├── swarm/route.ts     # Session orchestrator + human decision handler
    │       ├── benchmark/route.ts # Aggregate benchmark data
    │       ├── benchmark/run/route.ts
    │       ├── parse-stream/route.ts  # Qwen AI stream parser
    │       └── check-fraud/route.ts   # Qwen fraud detection
    ├── keeper/
    │   ├── intelligent-keeper.ts  # Keeper bot — calls batchUpdateStreams every 10s
    │   └── batch-optimizer.ts     # Qwen-Turbo batch scheduler (Gemini removed)
    ├── lib/agents/
    │   ├── types.ts               # SwarmSession, AgentMessage, YieldOpportunity
    │   ├── store.ts               # Redis session store (ioredis, falls back to memory)
    │   ├── swarm.ts               # Orchestration loop — persists to Redis after every step
    │   ├── manager.ts             # Qwen-Plus decomposition + debate adjudication
    │   ├── analyst.ts             # DEX API fetcher + Qwen-Turbo pool ranker
    │   ├── risk.ts                # Risk scoring + veto + Shannon Explorer reads
    │   ├── execution.ts           # Multicall3 encoder via viem encodeFunctionData
    │   ├── compliance.ts          # TreasuryPolicy.sol reader + rules engine
    │   ├── onchain.ts             # Raw eth_call for contract reads
    │   ├── submit.ts              # viem wallet client — signs & broadcasts tx
    │   ├── llm.ts                 # Unified Qwen/Claude client
    │   └── uid.ts                 # Local nanoid (avoids ESM incompatibility)
    ├── hooks/
    │   ├── useStreamContract.ts   # Stream read/write wagmi hooks
    │   └── useTemplates.ts        # Stream template hooks
    ├── components/
    │   └── layout/Header.tsx      # Navigation: War Room, Benchmark, Create, My Streams, Analytics
    ├── lib/
    │   ├── contracts.ts           # Contract addresses + Somnia chain config
    │   ├── abis/                  # StreamPay, StreamFactory, StreamKeeper ABIs
    │   └── pino-stub.js           # Browser no-op for WalletConnect pino crash fix
    ├── public/                    # Static assets (required by Next.js standalone)
    ├── docker-entrypoint.sh       # Replaces runtime placeholders, starts keeper + Next.js
    ├── tsconfig.keeper.json       # Separate tsconfig: compiles keeper → CommonJS JS
    └── next.config.js             # standalone output, webpack aliases, ioredis external
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Qwen API key from [dashscope-intl.aliyuncs.com](https://dashscope-intl.aliyuncs.com)
- MetaMask on Somnia Testnet (Chain ID: 50312, RPC: `https://dream-rpc.somnia.network`)
- Testnet STT from the [Somnia faucet](https://testnet.somnia.network)

### Run Locally (no Docker)

```bash
cd streampay
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

`npm run dev` starts **both** Next.js and the keeper bot concurrently:
- **Next.js** at [http://localhost:3000](http://localhost:3000)
- **Keeper bot** polling every 10 seconds — calls `batchUpdateStreams` on-chain so recipients can withdraw

To run Next.js only (no keeper):
```bash
npm run dev:next
```

### Run Locally with Docker + Redis

```bash
cp streampay/.env.example streampay/.env.local  # fill in values
docker compose up
```

This starts Redis + the app together. Sessions persist across restarts.

### Environment Variables (`streampay/.env.local`)

```env
# LLM — Qwen preferred, Claude fallback
QWEN_API_KEY=                              # Powers all 5 agents + AI features + keeper optimizer
ANTHROPIC_API_KEY=                         # Fallback if no Qwen key

# On-chain contracts (Somnia Testnet — already deployed)
NEXT_PUBLIC_TREASURY_POLICY_ADDRESS=0x2e42ffe3c108ff1c0e0f4e70cc3e36092b068c6e
NEXT_PUBLIC_RISK_ORACLE_ADDRESS=0xb3242569cd189b2e4e8949388d4b7c12000f5476
NEXT_PUBLIC_STREAM_PAY_ADDRESS=0x434ad66b34abe01c91eef1d24a1f2efede12c194
NEXT_PUBLIC_STREAM_KEEPER_ADDRESS=0xb6b76f3c8fa04300e9564f65dc75165ba8ff44ba
NEXT_PUBLIC_STREAM_FACTORY_ADDRESS=0x0781293537e5bb80f23dee95f095d8e94a6537d8

# Keeper — signs approved multicall TXs + calls batchUpdateStreams every 10s
KEEPER_PRIVATE_KEY=                        # Somnia testnet wallet private key

# Redis — persists swarm sessions across restarts (injected automatically by docker-compose)
REDIS_URL=redis://localhost:6379           # leave blank if not using Redis locally

# Wallet connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=      # From cloud.walletconnect.com

# Somnia Agent Kit
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
AGENT_REGISTRY_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
AGENT_EXECUTOR_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
```

### Deploy Contracts (already deployed — only needed for a fresh deploy)

```bash
cd contracts
npm install
npx hardhat compile
PRIVATE_KEY=0x... NETWORK=somniaTestnet npx ts-node scripts/deploy.ts
```

---

## Docker Deployment

### How the container works

```
docker-entrypoint.sh
  │
  ├─ sed: replace __SYNDICHAIN_*__ placeholders in built JS
  │
  ├─ node keeper-dist/keeper/intelligent-keeper.js &   ← background
  │       every 10s: batchUpdateStreams on all active streams
  │
  └─ exec node standalone/server.js                    ← foreground (PID 1)
        connects to Redis via REDIS_URL at runtime
```

### CI/CD via GitHub Actions

Push to `main` triggers `.github/workflows/ci-cd.yml`:

1. **Typecheck & Lint** — `tsc --noEmit` + `next lint`
2. **Build & Push** — Docker image pushed to `<DOCKER_USERNAME>/syndichain:latest`
3. **Deploy** — copies `docker-compose.yml` to server via SCP, then SSH runs `docker compose up -d`

**GitHub Secrets required:**

| Secret | Value |
|--------|-------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub access token |
| `SSH_HOST` | Server IP |
| `SSH_USERNAME` | SSH user (e.g. `ubuntu`) |
| `SSH_PRIVATE_KEY` | Full SSH private key |

### Server setup

Create `~/syndichain/.env.app`:

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_wc_id
QWEN_API_KEY=your_qwen_key
ANTHROPIC_API_KEY=your_anthropic_key
KEEPER_PRIVATE_KEY=your_somnia_testnet_private_key
REDIS_URL=redis://redis:6379
```

```bash
chmod 600 ~/syndichain/.env.app
```

`REDIS_URL` is also injected by `docker-compose.yml` via the `environment:` block, so the app always connects to the co-located Redis container regardless of what's in `.env.app`.

### What docker-compose.yml provides

- **Redis 7 Alpine** — persistent volume (`redis-data`), append-only mode, healthcheck
- **App container** — waits for Redis healthy before starting, `REDIS_URL` auto-injected
- Sessions stored under key prefix `syndichain:session:*` with 24-hour TTL
- Swarm session state written to Redis after every agent step — polling works across restarts

---

## Key Technical Decisions

**Qwen-Plus for Manager, Qwen-Turbo for workers**
Manager reasoning (debate adjudication, task decomposition) needs deeper context. Workers (pool ranking, risk scoring, batch optimization) are fast structured tasks — Turbo is sufficient and 3× cheaper.

**Redis hybrid store (memory + Redis)**
The in-memory Map is the primary store for active in-flight sessions to avoid Redis round trips on every message push. Redis is written after every agent step via `persist()`. On `getSession`, Redis is checked as fallback if the session isn't in memory (e.g. after server restart). This gives both speed and durability.

**`ioredis` as webpack external + manual standalone copy**
Next.js standalone doesn't bundle webpack externals. `ioredis` is added to `config.externals` to prevent bundling (it has native bindings), and its `node_modules` directory is explicitly copied into `standalone/node_modules/` in the Dockerfile so Node.js can resolve it at runtime.

**Raw `eth_call` for on-chain reads**
Avoids heavy SDK dependency in the server-side agent bundle. `onchain.ts` does direct JSON-RPC — same result, zero extra imports.

**`somnia-agent-kit` as webpack external**
The SDK spawns worker threads (pino + thread-stream) that Next.js webpack cannot bundle. Marking it external lets Node.js resolve it at runtime on the server only.

**`tryAggregate(requireSuccess=false)` for Multicall3**
Individual pool deposit calls may fail on testnet. The container multicall TX still lands on-chain, proving the batching mechanism without reverting on inner call failures.

**`pino-stub.js` browser alias**
WalletConnect imports pino at browser runtime. A webpack alias pointing it to a no-op stub eliminates the `pino is not defined` crash.

**Keeper bot runs alongside Next.js**
`StreamPay.sol` stores `realTimeBalance` in contract storage — only updates when `batchUpdateStreams()` is called. Without the keeper, withdraw transactions revert even when the UI shows a balance. The keeper fixes this by updating on-chain every 10 seconds.

**Gemini fully removed**
All AI features use Qwen exclusively via Alibaba Cloud DashScope (`dashscope-intl.aliyuncs.com/compatible-mode/v1`), with Claude as an optional fallback. `batch-optimizer.ts` was the last Gemini holdout — now uses Qwen-Turbo with a no-AI fallback that always executes.

---

## Track 3 Alignment

| Requirement | Implementation |
|-------------|----------------|
| 5 specialized agents | Manager, Analyst, Risk, Execution, Compliance |
| Task decomposition with JSON sub-tasks | Manager outputs structured sub-task array |
| Veto/debate protocol | Risk score > 70 → 2-round LLM debate → human escalation on deadlock |
| Smart contracts | TreasuryPolicy.sol + SomniaAgentRiskOracle.sol on Somnia Testnet |
| War Room dashboard | Live agent message board with Framer Motion AnimatePresence |
| Benchmark tab | 20-trial aggregate + live head-to-head runner |
| Qwen-Plus / Qwen-Turbo | Manager uses Qwen-Plus; all workers + keeper use Qwen-Turbo |
| Real DEX API calls | Somnia Exchange + Potion Swap with `Promise.allSettled` fallback |
| Somnia Agent Kit Multicall | `ChainClient` + `MultiCall` SDK + viem `encodeFunctionData` |
| Shannon Explorer API | `/api/v2/smart-contracts/{address}` for on-chain risk data |
| Human-in-the-loop | Approve/Reject panel in War Room before any broadcast |
| On-chain submission | viem wallet client + live gas price from `eth_feeHistory` |
| Session persistence | Redis via ioredis — survives server restarts, 24h TTL |
| Keeper bot | Runs alongside Next.js (dev) and in Docker (prod), updates streams every 10s |
| CI/CD | GitHub Actions: typecheck → Docker build/push → docker compose deploy via SSH |

---

## Known Limitations

- **DEX APIs unavailable on testnet** — falls back to enriched static pool data with real deployed contract addresses.
- **Multicall inner calls revert** — target contracts don't implement `deposit(uint256)`. The container TX succeeds (`requireSuccess=false`), proving the batching mechanism.
- **KEEPER_PRIVATE_KEY required for broadcast** — without it, the swarm runs in simulation mode and prints calldata for manual submission.
- **Keeper wallet needs STT for gas** — get testnet STT from the [Somnia faucet](https://testnet.somnia.network) for the keeper address.
