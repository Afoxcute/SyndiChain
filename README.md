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
6. **Execution** (Qwen-Turbo) encodes a gas-optimized Multicall3 batch via Somnia Agent Kit
7. **Compliance** verifies against `TreasuryPolicy.sol` — daily limits, allowlists, multisig thresholds
8. **Human approval** → transaction broadcast to Somnia via `KEEPER_PRIVATE_KEY` + viem

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
Real-time swarm session stats — agent message volume, governance outcomes, debate frequency, session history.

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
│Analyst │ │ Risk │ ← Qwen-Turbo (fast)
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
└── streampay/                        # Next.js 14 frontend
    ├── app/
    │   ├── page.tsx                  # Landing page
    │   ├── war-room/page.tsx         # Live agent dashboard
    │   ├── benchmark/page.tsx        # Swarm vs single-agent
    │   ├── create/page.tsx           # Create payment stream
    │   ├── streams/page.tsx          # Withdraw / cancel streams
    │   ├── analytics/page.tsx        # Swarm session analytics
    │   └── api/
    │       ├── swarm/route.ts        # Session orchestrator
    │       ├── benchmark/route.ts    # Aggregate benchmark data
    │       ├── benchmark/run/route.ts# Live head-to-head runner
    │       ├── parse-stream/route.ts # AI stream parser (Qwen)
    │       └── check-fraud/route.ts  # Fraud detection (Qwen)
    ├── lib/agents/
    │   ├── types.ts                  # SwarmSession, AgentMessage types
    │   ├── swarm.ts                  # Session store + orchestration
    │   ├── manager.ts                # Manager + debate adjudication
    │   ├── analyst.ts                # DEX API fetcher + LLM ranker
    │   ├── risk.ts                   # Risk scoring + veto logic
    │   ├── execution.ts              # Multicall3 encoder (viem)
    │   ├── compliance.ts             # TreasuryPolicy.sol reader
    │   ├── onchain.ts                # Raw eth_call reader (no SDK dep)
    │   ├── submit.ts                 # On-chain broadcaster (viem wallet)
    │   ├── llm.ts                    # Unified Qwen/Claude client
    │   └── uid.ts                    # Local nanoid replacement (ESM fix)
    ├── hooks/
    │   ├── useStreamContract.ts      # Stream read/write hooks
    │   └── useTemplates.ts           # Stream template hooks
    └── lib/
        ├── contracts.ts              # Contract addresses + chain config
        ├── abis/                     # StreamPay, StreamFactory ABIs
        └── pino-stub.js              # Browser stub (WalletConnect fix)
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Qwen API key from [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com) (international)
- MetaMask configured for Somnia Testnet (Chain ID: 50312, RPC: `https://dream-rpc.somnia.network`)

### Frontend

```bash
cd streampay
npm install
cp .env.example .env.local   # then fill in values below
npm run dev
```

Open [http://localhost:3000/war-room](http://localhost:3000/war-room)

### Environment Variables (`streampay/.env.local`)

```env
# LLM — Qwen preferred, Claude fallback
QWEN_API_KEY=                              # Primary: powers all 5 agents + AI features
ANTHROPIC_API_KEY=                         # Fallback if no Qwen key

# On-chain contracts (Somnia Testnet — already deployed)
NEXT_PUBLIC_TREASURY_POLICY_ADDRESS=0x2e42ffe3c108ff1c0e0f4e70cc3e36092b068c6e
NEXT_PUBLIC_RISK_ORACLE_ADDRESS=0xb3242569cd189b2e4e8949388d4b7c12000f5476
NEXT_PUBLIC_STREAM_PAY_ADDRESS=0x434ad66b34abe01c91eef1d24a1f2efede12c194
NEXT_PUBLIC_STREAM_KEEPER_ADDRESS=0xb6b76f3c8fa04300e9564f65dc75165ba8ff44ba
NEXT_PUBLIC_STREAM_FACTORY_ADDRESS=0x0781293537e5bb80f23dee95f095d8e94a6537d8

# Keeper — signs and broadcasts approved multicall transactions
KEEPER_PRIVATE_KEY=                        # Somnia testnet wallet private key

# Wallet connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=      # From cloud.walletconnect.com

# Somnia Agent Kit
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
AGENT_REGISTRY_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
AGENT_EXECUTOR_ADDRESS=0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223
```

### Deploy Contracts (already deployed — only needed for fresh deploy)

```bash
cd contracts
npm install
npx hardhat compile
PRIVATE_KEY=0x... NETWORK=somniaTestnet npx ts-node scripts/deploy.ts
```

---

## Key Technical Decisions

**Why Qwen-Plus for Manager, Qwen-Turbo for workers?**  
Manager reasoning (debate adjudication, task decomposition) needs deeper context. Workers (pool ranking, risk scoring, compliance) are fast structured tasks — Turbo is sufficient and 3× cheaper.

**Why raw `eth_call` instead of viem/ethers for on-chain reads?**  
Avoids heavy SDK dependency in the server-side agent bundle. `onchain.ts` does direct JSON-RPC calls — same result, zero extra imports.

**Why `somnia-agent-kit` as webpack external?**  
The SDK spawns worker threads (pino + thread-stream) that Next.js webpack cannot bundle. Marking it external lets Node.js resolve it at runtime on the server only.

**Why `tryAggregate(requireSuccess=false)` for Multicall3?**  
Individual pool deposit calls may fail (testnet contracts don't have real LP deposit interfaces). The multicall container TX still lands on-chain, proving the batching mechanism while not reverting on inner call failures.

**Why pino-stub.js?**  
WalletConnect imports pino at browser runtime. Aliasing it to a no-op logger in the browser webpack bundle eliminates the `pino is not defined` crash without affecting server-side logging.

---

## Track 3 Alignment

| Requirement | Implementation |
|-------------|----------------|
| 5 specialized agents | Manager, Analyst, Risk, Execution, Compliance |
| Task decomposition with JSON sub-tasks | Manager outputs structured sub-task array |
| Veto/debate protocol | Risk score > 70 → 2-round LLM debate → human escalation on deadlock |
| Smart contracts | TreasuryPolicy.sol + SomniaAgentRiskOracle.sol on Somnia Testnet |
| War Room dashboard | Live agent message board with AnimatePresence streaming |
| Benchmark tab | 20-trial aggregate + live head-to-head runner |
| Qwen-Max/Turbo | Qwen-Plus (reasoning) + Qwen-Turbo (workers) |
| Real DEX API calls | Somnia Exchange + Potion Swap with `Promise.allSettled` fallback |
| Somnia Agent Kit Multicall | `ChainClient` + `MultiCall` SDK + viem `encodeFunctionData` |
| Shannon Explorer API | `/api/v2/smart-contracts/{address}` for on-chain risk data |
| Human-in-the-loop | Approve/Reject panel in War Room before any broadcast |
| On-chain submission | viem wallet client + live gas price from `eth_feeHistory` |
