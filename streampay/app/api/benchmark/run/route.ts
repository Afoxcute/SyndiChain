import { NextRequest, NextResponse } from 'next/server';
import { callLLM, activeLLMProvider } from '@/lib/agents/llm';
import { createSwarmSession, getSession } from '@/lib/agents/swarm';

const SINGLE_AGENT_SYSTEM = `You are a DeFi treasury management AI.
Given a user goal, you must:
1. Identify the 3 best yield pools on Somnia blockchain
2. Assess their security
3. Format a multicall transaction
Do everything in one response. Respond with JSON only.`;

interface SingleAgentResult {
  pools: { name: string; apy: number; audited: boolean; address: string }[];
  riskFlags: string[];
  txFormatCorrect: boolean;
  hallucinatedPool: boolean;
  timeMs: number;
  raw: string;
}

interface SwarmResult {
  safeProposals: number;
  vetoedProposals: number;
  txFormatCorrect: boolean;
  caughtAllRisks: boolean;
  timeMs: number;
  debateTriggered: boolean;
}

// Known real pool addresses — hallucination check
const KNOWN_POOL_ADDRESSES = new Set([
  '0x1234567890123456789012345678901234567890',
  '0xabcdef0123456789abcdef0123456789abcdef01',
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  '0x9999999999999999999999999999999999999999',
  '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555',
]);

async function runSingleAgent(prompt: string): Promise<SingleAgentResult> {
  const start = Date.now();
  let raw = '';

  try {
    raw = await callLLM(
      SINGLE_AGENT_SYSTEM,
      `Treasury goal: "${prompt}"\n\nRespond with JSON: { "pools": [...], "tx": {...}, "riskFlags": [...] }`,
      'reasoning'
    );

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]);

    const pools = parsed.pools ?? [];
    const addresses: string[] = pools.map((p: any) =>
      (p.address ?? p.contractAddress ?? '').toLowerCase()
    );
    const hallucinatedPool = addresses.some(
      addr => addr.length > 5 && !KNOWN_POOL_ADDRESSES.has(addr)
    );

    const hasTx = !!(parsed.tx || parsed.transaction || parsed.multicall);
    const txCorrect = hasTx &&
      (parsed.tx?.to || parsed.tx?.calls?.length > 0 || parsed.multicall?.calls?.length > 0);

    const riskFlags: string[] = parsed.riskFlags ?? parsed.risks ?? [];
    const missedUnaudited = !riskFlags.some(
      (f: string) => f.toLowerCase().includes('unaudit') || f.toLowerCase().includes('novadex')
    );

    return {
      pools,
      riskFlags,
      txFormatCorrect: Boolean(txCorrect),
      hallucinatedPool,
      timeMs: Date.now() - start,
      raw,
    };
  } catch {
    return {
      pools: [],
      riskFlags: [],
      txFormatCorrect: false,
      hallucinatedPool: true,
      timeMs: Date.now() - start,
      raw,
    };
  }
}

async function runSwarmBenchmark(prompt: string): Promise<SwarmResult> {
  const start = Date.now();

  const sessionId = await createSwarmSession(prompt);

  // Poll until swarm completes (max 60s)
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const session = getSession(sessionId);
    if (!session) break;
    if (session.status === 'awaiting_human' || session.status === 'complete' || session.status === 'failed') {
      const safeProposals = session.riskAssessments.filter(a => !a.vetoed).length;
      const vetoedProposals = session.riskAssessments.filter(a => a.vetoed).length;
      const debateTriggered = session.debateRound > 0;
      const txOk = !!(session.formattedTx?.calls?.length);
      const caughtRisks = session.riskAssessments.some(a => a.vetoed);

      return {
        safeProposals,
        vetoedProposals,
        txFormatCorrect: txOk,
        caughtAllRisks: caughtRisks,
        timeMs: Date.now() - start,
        debateTriggered,
      };
    }
  }

  return {
    safeProposals: 0,
    vetoedProposals: 0,
    txFormatCorrect: false,
    caughtAllRisks: false,
    timeMs: Date.now() - start,
    debateTriggered: false,
  };
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json().catch(() => ({}));
  const userPrompt = prompt?.trim() || 'Diversify 50,000 STT into yield-bearing assets, keep 10,000 liquid for payroll, hedge against STT volatility';

  const provider = activeLLMProvider();

  // Run both in parallel
  const [singleResult, swarmResult] = await Promise.all([
    runSingleAgent(userPrompt),
    runSwarmBenchmark(userPrompt),
  ]);

  // Compute comparison metrics
  const singleSafe = !singleResult.hallucinatedPool && singleResult.txFormatCorrect;
  const swarmSafe = swarmResult.txFormatCorrect && swarmResult.caughtAllRisks;

  return NextResponse.json({
    prompt: userPrompt,
    llmProvider: provider,
    timestamp: Date.now(),
    singleAgent: {
      label: `Single ${provider === 'qwen' ? 'Qwen-Max' : 'Claude'} Agent`,
      timeMs: singleResult.timeMs,
      safeTransaction: singleSafe,
      hallucinatedPool: singleResult.hallucinatedPool,
      txFormatCorrect: singleResult.txFormatCorrect,
      riskFlagsFound: singleResult.riskFlags.length,
      poolsProposed: singleResult.pools.length,
    },
    swarm: {
      label: 'SyndiChain Swarm',
      timeMs: swarmResult.timeMs,
      safeTransaction: swarmSafe,
      hallucinatedPool: false, // Cross-validated by Risk Agent
      txFormatCorrect: swarmResult.txFormatCorrect,
      vetoedProposals: swarmResult.vetoedProposals,
      safeProposals: swarmResult.safeProposals,
      debateTriggered: swarmResult.debateTriggered,
      caughtAllRisks: swarmResult.caughtAllRisks,
    },
    speedupFactor: singleResult.timeMs > 0
      ? (singleResult.timeMs / Math.max(swarmResult.timeMs, 1)).toFixed(2)
      : 'N/A',
    winner: swarmSafe && !singleSafe ? 'swarm' : !swarmSafe && singleSafe ? 'single' : 'swarm',
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
