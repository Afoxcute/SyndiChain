# SyndiChain Frontend — Next.js 14

The web application for SyndiChain. Runs the multi-agent swarm, serves the War Room dashboard, and connects to deployed Somnia Testnet contracts.

## Stack

- **Next.js 14** (App Router)
- **wagmi v2 + RainbowKit** — wallet connection
- **viem** — contract reads, ABI encoding, transaction broadcast
- **Qwen-Plus / Qwen-Turbo** via Dashscope API (OpenAI-compatible)
- **Framer Motion** — live agent message board animations
- **Recharts** — benchmark and analytics charts
- **Somnia Agent Kit** (`somnia-agent-kit@3.0.11`) — Multicall3 SDK

## Dev Setup

```bash
npm install
cp .env.example .env.local   # fill in QWEN_API_KEY + contract addresses
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000)

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
| `/api/parse-stream` | POST | AI parse plain-English stream description |
| `/api/check-fraud` | POST | Fraud risk score for stream parameters |

## Agent Files (`lib/agents/`)

| File | Purpose |
|------|---------|
| `types.ts` | `SwarmSession`, `AgentMessage`, `YieldOpportunity`, etc. |
| `swarm.ts` | In-memory session store, orchestration loop, human decision handler |
| `manager.ts` | Qwen-Plus decomposition + debate adjudication |
| `analyst.ts` | DEX API fetcher + Qwen-Turbo pool ranker + debate arguments |
| `risk.ts` | Risk scoring, veto logic, Shannon Explorer + oracle reads |
| `execution.ts` | Multicall3 encoding via viem `encodeFunctionData` + Somnia Agent Kit |
| `compliance.ts` | TreasuryPolicy.sol reader + rules engine |
| `onchain.ts` | Raw `eth_call` for contract reads (no SDK dependency) |
| `submit.ts` | viem wallet client — signs and broadcasts approved tx |
| `llm.ts` | Unified Qwen/Claude client with mode selection |
| `uid.ts` | Local nanoid replacement (avoids ESM incompatibility) |

## Environment Variables

```env
# LLM
QWEN_API_KEY=                              # Powers all agents + AI features
ANTHROPIC_API_KEY=                         # Fallback

# Deployed contracts (Somnia Testnet)
NEXT_PUBLIC_TREASURY_POLICY_ADDRESS=0x2e42ffe3c108ff1c0e0f4e70cc3e36092b068c6e
NEXT_PUBLIC_RISK_ORACLE_ADDRESS=0xb3242569cd189b2e4e8949388d4b7c12000f5476
NEXT_PUBLIC_STREAM_PAY_ADDRESS=0x434ad66b34abe01c91eef1d24a1f2efede12c194
NEXT_PUBLIC_STREAM_KEEPER_ADDRESS=0xb6b76f3c8fa04300e9564f65dc75165ba8ff44ba
NEXT_PUBLIC_STREAM_FACTORY_ADDRESS=0x0781293537e5bb80f23dee95f095d8e94a6537d8

# Transaction broadcaster
KEEPER_PRIVATE_KEY=                        # Somnia testnet private key

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Somnia Agent Kit
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
AGENT_REGISTRY_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
AGENT_EXECUTOR_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
```

## Known Limitations

- **In-memory session store** — sessions are lost on server restart. Use Redis for production.
- **DEX APIs unavailable on testnet** — falls back to enriched static pool data using real deployed contract addresses as targets.
- **Multicall inner calls revert** — target contracts don't implement `deposit(uint256)`. The container multicall TX succeeds on-chain (`requireSuccess=false`), proving the batching mechanism.
- **KEEPER_PRIVATE_KEY required for broadcast** — without it, the swarm runs fully in simulation mode and prints calldata for manual submission.
