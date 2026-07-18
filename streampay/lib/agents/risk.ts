import { AgentMessage, YieldOpportunity, RiskAssessment } from './types';
import { uid as nanoid } from './uid';
import { callLLM, extractJSON } from './llm';
import { readOnChainRiskScore } from './onchain';

const RISK_SYSTEM_PROMPT = `You are the Risk Agent of SyndiChain, a DAO treasury security specialist.
You are skeptical and data-driven. Evaluate DeFi protocol safety using on-chain data.
Always quantify: give exact exploit probability estimates, not vague warnings.
Respond only with valid JSON.`;

const VETO_THRESHOLD = 70;
const SHANNON_EXPLORER = 'https://shannon-explorer.somnia.network/api/v2';

// On-chain risk oracle data (mirrors SomniaAgentRiskOracle.sol)
const RISK_ORACLE: Record<string, {
  auditScore: number; volatility: number; incidents: number; tvlDropPct: number;
}> = {
  '0x1234567890123456789012345678901234567890': { auditScore: 88, volatility: 25, incidents: 0, tvlDropPct: 5 },
  '0xabcdef0123456789abcdef0123456789abcdef01': { auditScore: 92, volatility: 20, incidents: 0, tvlDropPct: 3 },
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef': { auditScore: 0,  volatility: 70, incidents: 1, tvlDropPct: 45 },
  '0x9999999999999999999999999999999999999999': { auditScore: 95, volatility: 5,  incidents: 0, tvlDropPct: 1 },
  '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555': { auditScore: 72, volatility: 35, incidents: 0, tvlDropPct: 12 },
};

// ─── Block Explorer API ───────────────────────────────────────────────────────

interface ExplorerContractData {
  isVerified: boolean;
  name: string | null;
  txCount: number;
  creationTx: string | null;
}

async function fetchContractFromExplorer(address: string): Promise<ExplorerContractData | null> {
  try {
    const res = await fetch(`${SHANNON_EXPLORER}/smart-contracts/${address}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      isVerified: Boolean(data.is_verified ?? data.verified),
      name: data.name ?? data.contract_name ?? null,
      txCount: parseInt(data.transactions_count ?? data.tx_count ?? '0', 10),
      creationTx: data.creation_tx_hash ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Quantitative scoring ─────────────────────────────────────────────────────

function computeRiskScore(
  proposal: YieldOpportunity,
  oracle: typeof RISK_ORACLE[string] | undefined,
  explorerData: ExplorerContractData | null
): number {
  if (!oracle) return 85; // Unknown protocol — max risk

  let score = 0;
  if (!proposal.audited) score += 40;
  else score += (100 - oracle.auditScore) * 0.30;

  score += oracle.volatility * 0.25;
  score += oracle.tvlDropPct * 0.20;
  if (oracle.incidents > 0) score += 25;
  if (proposal.apy > 25 && proposal.tvl < 1_000_000) score += 10;

  // Block explorer bonus: verified source = slight trust boost
  if (explorerData?.isVerified) score -= 5;
  // Very low tx count = untested contract
  if (explorerData !== null && explorerData.txCount < 100) score += 8;

  return Math.min(Math.round(score), 100);
}

function buildRiskReasons(
  proposal: YieldOpportunity,
  oracle: typeof RISK_ORACLE[string] | undefined,
  explorerData: ExplorerContractData | null,
  score: number
): string[] {
  const r: string[] = [];
  if (!proposal.audited) r.push('Contract is UNAUDITED — no independent security review');
  if (oracle?.incidents && oracle.incidents > 0) r.push(`${oracle.incidents} historical exploit(s) detected on-chain`);
  if (proposal.apy > 25) r.push(`Anomalously high APY (${proposal.apy.toFixed(1)}%) — likely unsustainable emissions`);
  if (proposal.tvl < 1_000_000) r.push(`Low TVL ($${(proposal.tvl / 1000).toFixed(0)}K) — limited exit liquidity`);
  if (oracle?.tvlDropPct && oracle.tvlDropPct > 20) r.push(`TVL dropped ${oracle.tvlDropPct}% from peak — confidence loss signal`);
  if (oracle?.volatility && oracle.volatility > 50) r.push(`High on-chain volatility score: ${oracle.volatility}/100`);
  if (explorerData !== null && !explorerData.isVerified) r.push('Contract source code NOT verified on Shannon Explorer');
  if (explorerData !== null && explorerData.txCount < 100) r.push(`Only ${explorerData.txCount} transactions — contract is battle-untested`);
  if (score < 40) r.push('All quantitative security checks passed');
  return r;
}

// ─── LLM qualitative analysis ─────────────────────────────────────────────────

async function llmRiskAnalysis(
  proposal: YieldOpportunity,
  quantScore: number,
  reasons: string[],
  explorerData: ExplorerContractData | null
): Promise<{ exploitProbability: number; additionalRisks: string[] }> {
  const prompt = `
Analyze the DeFi risk for this Somnia protocol:

Protocol: ${proposal.protocol}
Pool: ${proposal.pool}
APY: ${proposal.apy.toFixed(1)}%
TVL: $${proposal.tvl.toLocaleString()}
Audited: ${proposal.audited} (${proposal.auditFirms.join(', ') || 'none'})
Contract verified on-chain: ${explorerData?.isVerified ?? 'unknown'}
Transaction count: ${explorerData?.txCount ?? 'unknown'}

Quantitative risk score: ${quantScore}/100
Known risk factors: ${reasons.join('; ')}

Respond with JSON only:
{
  "exploitProbability": 0.00,
  "additionalRisks": ["risk not already listed"],
  "oneLiner": "brief verdict"
}`;

  try {
    const response = await callLLM(RISK_SYSTEM_PROMPT, prompt, 'fast');
    const parsed = JSON.parse(extractJSON(response));
    return {
      exploitProbability: Math.min(Math.max(parseFloat(parsed.exploitProbability) || 0, 0), 1),
      additionalRisks: parsed.additionalRisks ?? [],
    };
  } catch {
    // Deterministic fallback
    return {
      exploitProbability: quantScore / 250,
      additionalRisks: [],
    };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runRiskAgent(
  proposals: YieldOpportunity[]
): Promise<{ messages: AgentMessage[]; assessments: RiskAssessment[]; vetoes: string[] }> {
  const messages: AgentMessage[] = [];
  const assessments: RiskAssessment[] = [];
  const vetoes: string[] = [];

  const oracleAddr = process.env.NEXT_PUBLIC_RISK_ORACLE_ADDRESS;
  const oracleSource = oracleAddr
    ? `SomniaAgentRiskOracle.sol @ ${oracleAddr}`
    : 'SomniaAgentRiskOracle (local registry — deploy and set NEXT_PUBLIC_RISK_ORACLE_ADDRESS for live reads)';

  messages.push({
    id: nanoid(), agent: 'risk', type: 'risk_assessment',
    content: `Querying Shannon Explorer (${SHANNON_EXPLORER}) + ${oracleSource} for ${proposals.length} proposal(s)...`,
    timestamp: Date.now(),
  });

  // Fetch block explorer data + on-chain oracle scores for all proposals in parallel
  const [explorerResults, onChainScores] = await Promise.all([
    Promise.all(proposals.map(p => fetchContractFromExplorer(p.contractAddress))),
    Promise.all(proposals.map(p => readOnChainRiskScore(p.contractAddress))),
  ]);

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];
    const explorerData = explorerResults[i];
    const onChainScore = onChainScores[i];

    // Prefer on-chain oracle score if available, otherwise use local registry
    const oracle = RISK_ORACLE[proposal.contractAddress.toLowerCase()] ??
                   RISK_ORACLE[proposal.contractAddress];

    const localScore = computeRiskScore(proposal, oracle, explorerData);
    // If the deployed oracle returns a score, blend it (60% on-chain, 40% local)
    const score = onChainScore
      ? Math.round(onChainScore.score * 0.6 + localScore * 0.4)
      : localScore;
    const tierFromOnChain = onChainScore?.tier as RiskAssessment['tier'] | undefined;
    const tier: RiskAssessment['tier'] = tierFromOnChain ?? (score >= 70 ? 'HIGH_RISK' : score >= 40 ? 'CAUTION' : 'SAFE');
    const vetoed = score >= VETO_THRESHOLD;
    const reasons = buildRiskReasons(proposal, oracle, explorerData, score);

    // LLM qualitative analysis for each proposal
    const { exploitProbability, additionalRisks } = await llmRiskAnalysis(
      proposal, score, reasons, explorerData
    );

    const allReasons = [...reasons, ...additionalRisks];

    const assessment: RiskAssessment = {
      protocol: proposal.protocol,
      riskScore: score,
      tier,
      vetoed,
      reasons: allReasons,
      exploitProbability,
    };
    assessments.push(assessment);

    const explorerNote = explorerData
      ? `Contract ${explorerData.isVerified ? '✅ verified' : '❌ unverified'} on Shannon Explorer (${explorerData.txCount} txns)`
      : 'Explorer data unavailable';

    const oracleNote = onChainScore
      ? `On-chain oracle score: ${onChainScore.score}/100 (${onChainScore.tier})`
      : 'Oracle: local registry';

    if (vetoed) {
      vetoes.push(proposal.pool);
      messages.push({
        id: nanoid(), agent: 'risk', type: 'veto',
        content: buildVetoMessage(proposal, assessment, explorerNote, oracleNote),
        data: assessment,
        timestamp: Date.now(),
      });
    } else {
      messages.push({
        id: nanoid(), agent: 'risk', type: 'risk_assessment',
        content: `✅ **${proposal.protocol} — ${proposal.pool}** cleared (risk score: ${score}/100, ${tier})\n${explorerNote} | ${oracleNote}`,
        data: { score, tier, explorerNote, oracleNote },
        timestamp: Date.now(),
      });
    }
  }

  const safeCount = assessments.filter(a => !a.vetoed).length;
  messages.push({
    id: nanoid(), agent: 'risk', type: 'risk_assessment',
    content: `Risk assessment complete via Shannon Explorer + SomniaAgentRiskOracle.\n✅ ${safeCount} cleared  🚫 ${vetoes.length} vetoed\n\n${
      vetoes.length > 0
        ? `Vetoed: ${vetoes.join(', ')}. Triggering Manager debate protocol.`
        : 'All proposals cleared. Handing off to Execution Agent.'
    }`,
    data: { assessments, vetoThreshold: VETO_THRESHOLD },
    timestamp: Date.now(),
  });

  return { messages, assessments, vetoes };
}

export function buildDebateCounterpoints(assessment: RiskAssessment): string[] {
  return assessment.reasons.slice(0, 3);
}

function buildVetoMessage(
  proposal: YieldOpportunity,
  assessment: RiskAssessment,
  explorerNote: string,
  oracleNote: string
): string {
  return (
    `🚫 **VETO ISSUED** — ${proposal.protocol}: ${proposal.pool}\n\n` +
    `Risk Score: ${assessment.riskScore}/100 (veto threshold: ${VETO_THRESHOLD})\n` +
    `Exploit Probability: ${((assessment.exploitProbability ?? 0) * 100).toFixed(1)}%\n` +
    `${explorerNote} | ${oracleNote}\n\n` +
    `Risk Factors:\n${assessment.reasons.map(r => `• ${r}`).join('\n')}\n\n` +
    `Initiating debate protocol — Analyst must provide 3 counter-arguments.`
  );
}
