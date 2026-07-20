# SyndiChain Frontend — Next.js 14

The web application for SyndiChain. Runs the multi-agent swarm, serves the War Room dashboard, connects to deployed Somnia Testnet contracts, and runs the keeper bot that keeps stream balances current on-chain.

## Stack

- **Next.js 14** (App Router, `output: standalone`)
- **wagmi v2 + RainbowKit** — wallet connection
- **viem** — contract reads, ABI encoding, transaction broadcast, live gas pricing
- **Qwen-Plus / Qwen-Turbo** via Alibaba Cloud DashScope API (OpenAI-compatible)
- **Framer Motion** — live agent message board animations
- **Recharts** — benchmark and analytics charts
- **Somnia Agent Kit** (`somnia-agent-kit@3.0.11`) — Multicall3 SDK
- **concurrently** — runs Next.js + keeper bot in parallel with `npm run dev`

## Dev Setup

```bash
npm install
cp .env.example .env.local   # fill in QWEN_API_KEY, KEEPER_PRIVATE_KEY, contract addresses
npm run dev
```

Starts both Next.js at [http://localhost:3000](http://localhost:3000) and the keeper bot (updates stream balances on-chain every 10s).

To run Next.js only:
```bash
npm run dev:next
```

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Next.js + keeper bot (concurrently) |
| `npm run dev:next` | Next.js only |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run keeper` | Keeper bot only |
| `npm run lint` | ESLint |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — agent society overview, execution flow |
| `/war-room` | Live multi-agent swarm dashboard |
| `/benchmark` | Swarm vs single-agent head-to-head |
| `/create` | AI-powered stream creation + fraud detection |
| `/streams` | Recipient withdraw + sender cancel dashboard |
| `/analytics` | Swarm session stats and agent activity charts |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/swarm` | POST | Start swarm session or submit human decision |
| `/api/swarm?sessionId=` | GET | Poll session state |
| `/api/swarm` | GET | List all sessions (for analytics) |
| `/api/benchmark` | GET | Aggregate benchmark data (20 trials) |
| `/api/benchmark/run` | POST | Live head-to-head benchmark run |
| `/api/parse-stream` | POST | Qwen-Turbo — parse plain-English stream description |
| `/api/check-fraud` | POST | Qwen-Turbo — fraud risk score for stream parameters |

## Agent Files (`lib/agents/`)

| File | Purpose |
|------|---------|
| `types.ts` | `SwarmSession`, `AgentMessage`, `YieldOpportunity`, `FormattedTransaction` |
| `swarm.ts` | In-memory session store, orchestration loop, human decision handler, `broadcastAndComplete()` |
| `manager.ts` | Qwen-Plus decomposition + debate adjudication |
| `analyst.ts` | DEX API fetcher + Qwen-Turbo pool ranker + debate arguments |
| `risk.ts` | Risk scoring, veto logic, Shannon Explorer + oracle reads |
| `execution.ts` | Multicall3 encoding via viem `encodeFunctionData` + Somnia Agent Kit |
| `compliance.ts` | TreasuryPolicy.sol reader + rules engine |
| `onchain.ts` | Raw `eth_call` for contract reads (no SDK dependency) |
| `submit.ts` | viem wallet client — signs and broadcasts approved tx via `KEEPER_PRIVATE_KEY` |
| `llm.ts` | Unified Qwen/Claude client with model selection |
| `uid.ts` | Local nanoid replacement (avoids ESM incompatibility) |

## Keeper Bot (`keeper/`)

| File | Purpose |
|------|---------|
| `intelligent-keeper.ts` | Main loop — fetches active streams, runs optimizer, calls `batchUpdateStreams` every 10s |
| `batch-optimizer.ts` | Qwen-Turbo batch scheduler — decides ordering; falls back to always-execute if Qwen unavailable |

The keeper is required for the **My Streams** withdraw feature. `StreamPay.sol` stores `realTimeBalance` in contract storage and only updates it when `batchUpdateStreams()` is called. Without the keeper, the withdraw transaction reverts even when the UI shows a balance. The keeper fixes this by pushing balance updates on-chain every 10 seconds.

## Environment Variables

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

# Keeper wallet — signs approved multicall TXs + calls batchUpdateStreams every 10s
KEEPER_PRIVATE_KEY=                        # Somnia testnet private key (no 0x prefix needed)

# Wallet connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=      # From cloud.walletconnect.com

# Somnia Agent Kit
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
AGENT_REGISTRY_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
AGENT_EXECUTOR_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
```

## Docker

The `Dockerfile` at the repo root builds a production image that includes both the Next.js standalone server and the compiled keeper bot.

`docker-entrypoint.sh` (copied into the image):
1. Replaces `__SYNDICHAIN_*__` placeholder strings in the built JS with real env values from `--env-file .env.app`
2. Starts the keeper bot as a background process
3. Starts Next.js as PID 1

The keeper is compiled separately via `tsconfig.keeper.json` (CommonJS output) so it runs with plain `node` in the production image — no ts-node required.

## Known Limitations

- **In-memory session store** — sessions are lost on server restart. Use Redis for production.
- **DEX APIs unavailable on testnet** — falls back to enriched static pool data using real deployed contract addresses as targets.
- **Multicall inner calls revert** — target contracts don't implement `deposit(uint256)`. The container multicall TX succeeds (`requireSuccess=false`), proving the batching mechanism.
- **KEEPER_PRIVATE_KEY required for broadcast** — without it, the swarm runs in simulation mode.
- **Keeper wallet needs STT for gas** — get testnet STT from the [Somnia faucet](https://testnet.somnia.network).
