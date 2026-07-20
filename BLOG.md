# When Five Agents Disagree: Building a Multi-Agent DAO Treasury Swarm with Qwen Cloud

*Track 3: Multi-Agent Collaboration · Builder Journal · Global AI Hackathon with Qwen Cloud · July 2026*

---

The problem with single-agent treasury systems isn't intelligence — it's accountability.

Give one AI agent a treasury goal and it will give you an answer. Confidently. Even when the answer is wrong. There's no one to argue with it, no one to catch the bad risk assessment, no one to say "wait — that protocol had an exploit six months ago." The agent is brilliant and alone.

SyndiChain started from a simple premise: what if the agents argued?

Five specialized AI agents — Manager, Analyst, Risk, Execution, and Compliance — each with a distinct role, debate risky strategies in real time, veto unsafe proposals, and collaboratively construct gas-optimized transactions on Somnia Testnet. No transaction moves without passing through all five. And at every critical junction, a human gets the final word.

---

## Part 1: The Problem with Solo Agents

### One voice, no checks

Before we built the swarm, we prototyped a single-agent version. It worked beautifully in happy-path scenarios. Give it a treasury goal, it fetches yield data, scores the risk, formats a transaction. Done in four seconds.

But when we stress-tested it with adversarial inputs — high-risk pools dressed up with attractive APY numbers, recipient addresses with exploit history — it fell apart about 40% of the time. It would surface a pool with a 7.2% APY and completely miss that the underlying protocol had been drained three months ago.

The issue wasn't the model. Qwen-Plus is genuinely capable of catching that. The issue was *who it was talking to*. With no counterparty, there's no pressure to defend a position. No one asking "have you checked the exploit history?" No one forcing it to justify the risk score.

Multi-agent collaboration isn't about distributing computation. It's about creating institutional pressure — the same reason real governance committees exist.

---

## Part 2: The Qwen Cloud Stack

### Three capability tiers, one API shape

We use Alibaba Cloud DashScope for all AI inference, with every call going through the same base URL (`dashscope-intl.aliyuncs.com/compatible-mode/v1`) and the same OpenAI-compatible client. That compatibility is what made the architecture tractable — no separate SDK, no adapter layer, one shared client.

**Qwen-Plus — The Manager**

The Manager is the swarm's most expensive call, and it earns it. It does two distinct jobs: decomposing a plain-English treasury goal into structured parallel sub-tasks, and adjudicating when Analyst and Risk agents reach an impasse after two debate rounds.

The decomposition call produces a JSON array of sub-tasks with assigned agents, priority levels, and dependency chains. The adjudication call gets both sides' arguments verbatim and produces a verdict with reasoning. Qwen-Plus handles both because they require genuine reasoning — not just pattern matching.

```typescript
// lib/agents/manager.ts — adjudication call
const verdict = await llm.complete({
  model: 'qwen-plus',
  messages: [
    {
      role: 'system',
      content: `You are the Manager of a DAO treasury swarm. An Analyst and Risk agent
have debated for ${DEBATE_ROUNDS} rounds. Adjudicate. Output JSON:
{ "decision": "approve"|"reject"|"escalate", "reasoning": "...", "confidence": 0-100 }`
    },
    {
      role: 'user',
      content: `ANALYST POSITION:\n${analystArgs}\n\nRISK POSITION:\n${riskArgs}`
    }
  ],
  max_tokens: 400,
});
```

If confidence drops below 60, the Manager flags `"decision": "escalate"` and the human gets the full debate transcript in the War Room UI.

**Qwen-Turbo — The Four Workers**

Analyst, Risk, Execution, and the keeper bot's batch optimizer all run on Qwen-Turbo. These are fast, structured tasks — pool ranking, risk scoring, Multicall encoding, batch scheduling. Turbo is sufficient and roughly 3× cheaper than Plus. The model boundary between Manager and workers is one of the clearest cost optimizations in the project.

```typescript
// lib/agents/llm.ts — unified client, model passed per call
export async function complete({ model, messages, max_tokens }: LLMRequest) {
  const client = new OpenAI({
    apiKey: process.env.QWEN_API_KEY!,
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  });

  const res = await client.chat.completions.create({
    model,          // 'qwen-plus' or 'qwen-turbo'
    messages,
    max_tokens,
  });

  return res.choices[0].message.content;
}
```

The same client, the same API shape, the same error handling — just different model strings. This meant we could swap capability tiers without touching any call-site logic.

---

## Part 3: The Swarm Architecture

### How the five agents connect

```
User (plain English goal)
        │
        ▼
  /api/swarm  ─────────────────────► Redis (session after every step)
        │
        ▼
  ┌─────────────┐
  │   Manager   │  ← Qwen-Plus
  │  Decomposes │    Parallel sub-tasks
  └──────┬──────┘
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────┐
│Analyst │ │ Risk │  ← Qwen-Turbo
│DEX APIs│ │Oracle│
└────┬───┘ └──┬───┘
     │  veto? │
     └────┬───┘
          │ debate (2 rounds max)
          ▼
    Manager adjudicates  →  escalate to human if confidence < 60
          │
          ▼
    ┌───────────┐
    │ Execution │  ← Qwen-Turbo + viem encodeFunctionData
    │ Multicall3│    Somnia Agent Kit
    └─────┬─────┘
          ▼
    ┌────────────┐
    │ Compliance │  ← Rules engine (no LLM)
    │TreasuryPol.│    Reads TreasuryPolicy.sol on-chain
    └─────┬──────┘
          ▼
   Human Approval  →  broadcast via viem walletClient
```

Every session object — agent messages, debate transcripts, risk assessments, proposed transactions — is persisted to Redis via `ioredis` after every agent step. If the server restarts mid-debate, the session survives. The UI polls `/api/swarm?id=<sessionId>` and resumes from wherever the swarm left off.

---

## Part 4: The Debate Protocol

### Making agents argue productively

The debate protocol is the core differentiator. Without it, Risk could veto freely and Analyst could optimistically approve — and never be forced to reconcile.

Here's how it works:

1. **Analyst** fetches live pool data from Somnia Exchange and Potion Swap DEX APIs, ranks by expected yield, returns top candidates.
2. **Risk** calls `SomniaAgentRiskOracle.sol` on-chain and queries Shannon Explorer for contract audit history. If risk score > 70, it issues a veto with a reason.
3. **Debate opens** — Analyst defends its recommendation, Risk defends the veto. Qwen-Turbo writes both sides' arguments.
4. **Round 2** — each side responds to the other.
5. **Manager adjudicates** — reads both transcripts and returns a structured verdict.
6. **If `confidence < 60`** — human escalation. The user sees both arguments and chooses.

```typescript
// lib/agents/swarm.ts — debate loop
for (let round = 0; round < MAX_DEBATE_ROUNDS; round++) {
  const analystArg = await runDebateRound(session, 'analyst', riskVeto);
  const riskArg    = await runDebateRound(session, 'risk', analystPosition);
  await persist(session);  // Redis after every round

  const verdict = await manager.adjudicate(analystArg, riskArg);
  if (verdict.decision !== 'escalate') {
    session.debateVerdict = verdict;
    break;
  }
}

if (!session.debateVerdict || session.debateVerdict.decision === 'escalate') {
  session.status = 'awaiting_human';
  await persist(session);
  return; // pause — human resolves via /api/swarm POST
}
```

The `persist()` call after every round was a late addition — we originally only saved at the end of the full swarm run. When we tested server restarts mid-debate, every in-progress session was lost. Saving after each round costs a few milliseconds and makes the system genuinely resilient.

---

## Part 5: The Keeper Bot Problem

### Why stream withdrawals were silently reverting

We shipped `StreamPay.sol` — a contract that disburses STT to recipients per-second — and immediately ran into a confusing bug. Users would see their withdrawable balance growing in the UI but get a transaction revert when they tried to claim it. MetaMask showed "insufficient funds" even with 0.1 STT in the wallet.

The actual cause was subtle. `StreamPay.sol` stores `realTimeBalance` in contract storage. That stored value is only updated when `batchUpdateStreams()` is called. If no one calls it, `realTimeBalance` stays at zero — and the withdraw function checks against the stored value, not the computed time-elapsed amount.

The fix was `intelligent-keeper.ts`: a bot that calls `batchUpdateStreams()` on all active streams every 10 seconds, using Qwen-Turbo to decide batch priority.

```typescript
// keeper/intelligent-keeper.ts
setInterval(async () => {
  const activeStreamIds = await (publicClient.readContract as Function)({
    address: STREAM_PAY_ADDRESS,
    abi:     STREAM_PAY_ABI,
    functionName: 'getActiveStreamIds',
  }) as bigint[];

  const batch = await optimizer.selectBatch(activeStreamIds);
  if (!batch.isProfitable) return;

  const hash = await walletClient.writeContract({
    chain:        somniaTestnet,
    account,
    address:      STREAM_PAY_ADDRESS,
    abi:          STREAM_PAY_ABI,
    functionName: 'batchUpdateStreams',
    args:         [batch.streamIds.map(id => BigInt(id))],
  });
}, 10_000);
```

In development, the keeper starts automatically via `concurrently` alongside Next.js. In Docker, `docker-entrypoint.sh` starts it as a background process before handing PID 1 to Next.js. Recipients can now always withdraw without reverting.

---

## Part 6: What We Learned

### Hard lessons, honestly told

| Problem | What we tried first | What actually worked |
|---------|---------------------|----------------------|
| `ioredis` missing in Docker standalone | `npm ci` in runner stage | Mark as webpack external + manually copy `ioredis` and 3 peer deps into `standalone/node_modules/` |
| viem `sendTransaction` TS2345 error | Optional `maxFeePerGas?` + `gasPrice?` | Discriminated union type — explicit branch for each gas pricing mode |
| Stream withdrawals reverting silently | Debug the contract ABI | Write the keeper bot — `realTimeBalance` only updates on-chain when called |
| viem v2.19+ `readContract` EIP-7702 type bleed | Fight the types | `(publicClient.readContract as Function)(...)` — cast until upstream fixes |
| Health check failing after port change | Debug the app | Health check was hitting port 3000, app exposed on 80 — one-line fix |
| `getSession()` returning Promise instead of session | Add a new async wrapper | `await getSession()` — became async when Redis was added, missed two call sites |

### What Qwen Cloud unlocked specifically

The OpenAI-compatible interface (`dashscope-intl.aliyuncs.com/compatible-mode/v1`) meant we could run all five agents through a single `llm.ts` module with zero SDK divergence. Switching the Manager from Qwen-Turbo to Qwen-Plus for debate adjudication was a one-character model string change.

The cost split between Plus and Turbo maps directly onto the problem structure. Manager reasoning calls are rare and high-stakes — worth paying for. Worker calls happen in parallel on every session and need to be fast and cheap. Being able to express that split without leaving the same API surface was the architectural decision that kept the system economically viable.

> "The debate protocol only works because Qwen-Plus can genuinely hold two contradictory positions in context and produce a reasoned verdict. That's not a Turbo job."

---

## Part 7: The Numbers

**By the numbers:**

- 5 smart contracts deployed on Somnia Testnet
- 5 specialized AI agents, 2 Qwen model tiers
- 2 debate rounds max before human escalation
- 10-second keeper polling interval
- 24-hour Redis session TTL
- 95% safe transaction rate vs 58% single-agent baseline
- 9.8s average full swarm pipeline latency

---

## What's Next

The debate protocol is the piece we want to push further. Right now it runs for two rounds with a binary outcome — approve, reject, or escalate. The next step is weighted confidence propagation: if Risk's veto carries a 90-confidence score and Analyst's approval carries 55, the Manager factors confidence asymmetry into its adjudication, not just argument content.

We also want persistent agent memory across sessions — embedding past governance decisions and surfacing them as context when similar situations recur. An agent that remembers "the last three high-yield pools in this sector had exploit history within 6 months" is qualitatively more valuable than one that starts fresh every time.

---

**Links:**

- Live app: [http://47.252.51.168](http://47.252.51.168)
- Source code: [github.com/Afoxcute/SyndiChain](https://github.com/Afoxcute/SyndiChain)
- Qwen Cloud API: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

---

*Built for Global AI Hackathon with Qwen Cloud — Track 3: Multi-Agent Collaboration.*
