import { AgentMessage, YieldOpportunity, RiskAssessment } from './types';
import { uid as nanoid } from './uid';

const RISK_SYSTEM_PROMPT = `You are the Risk Agent of SyndiChain. You are a skeptical, data-driven security
analyst. Your job is to protect the treasury from bad outcomes. You evaluate smart contract security,
TVL stability, audit quality, and exploit history. When risk is too high, you issue a VETO with
specific data points. You must provide quantified probability estimates, not vague warnings.`;

const VETO_THRESHOLD = 70;

// Simulated risk oracle data (in production: call SomniaAgentRiskOracle.sol)
const RISK_ORACLE: Record<string, { auditScore: number; volatility: number; incidents: number; tvlDropPct: number }> = {
  '0x1234567890123456789012345678901234567890': { auditScore: 88, volatility: 25, incidents: 0, tvlDropPct: 5 },
  '0xabcdef0123456789abcdef0123456789abcdef01': { auditScore: 92, volatility: 20, incidents: 0, tvlDropPct: 3 },
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef': { auditScore: 0, volatility: 70, incidents: 1, tvlDropPct: 45 },
  '0x9999999999999999999999999999999999999999': { auditScore: 95, volatility: 5, incidents: 0, tvlDropPct: 1 },
  '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555': { auditScore: 72, volatility: 35, incidents: 0, tvlDropPct: 12 },
};

export async function runRiskAgent(
  proposals: YieldOpportunity[]
): Promise<{ messages: AgentMessage[]; assessments: RiskAssessment[]; vetoes: string[] }> {
  const messages: AgentMessage[] = [];
  const assessments: RiskAssessment[] = [];
  const vetoes: string[] = [];

  await sleep(500);

  messages.push({
    id: nanoid(),
    agent: 'risk',
    type: 'risk_assessment',
    content: `Querying SomniaAgentRiskOracle for ${proposals.length} proposals...`,
    timestamp: Date.now(),
  });

  await sleep(700);

  for (const proposal of proposals) {
    const oracle = RISK_ORACLE[proposal.contractAddress];
    const score = computeRiskScore(proposal, oracle);
    const tier = score >= 70 ? 'HIGH_RISK' : score >= 40 ? 'CAUTION' : 'SAFE';
    const vetoed = score >= VETO_THRESHOLD;

    const reasons = buildRiskReasons(proposal, oracle, score);

    const assessment: RiskAssessment = {
      protocol: proposal.protocol,
      riskScore: score,
      tier,
      vetoed,
      reasons,
      exploitProbability: oracle ? oracle.incidents > 0 ? 0.35 : score / 500 : 0.6,
    };

    assessments.push(assessment);

    if (vetoed) {
      vetoes.push(proposal.pool);
      messages.push({
        id: nanoid(),
        agent: 'risk',
        type: 'veto',
        content: buildVetoMessage(proposal, assessment),
        data: assessment,
        timestamp: Date.now(),
      });
    }
  }

  const safeCount = assessments.filter((a) => !a.vetoed).length;
  const vetoCount = vetoes.length;

  messages.push({
    id: nanoid(),
    agent: 'risk',
    type: 'risk_assessment',
    content: `Risk assessment complete.\n✅ ${safeCount} proposal(s) cleared\n🚫 ${vetoCount} proposal(s) vetoed\n\n${
      vetoes.length > 0
        ? `Vetoed pools: ${vetoes.join(', ')}. Initiating debate protocol for contested proposals.`
        : 'All proposals cleared. Handing off to Execution Agent.'
    }`,
    data: { assessments, vetoThreshold: VETO_THRESHOLD },
    timestamp: Date.now(),
  });

  return { messages, assessments, vetoes };
}

function computeRiskScore(proposal: YieldOpportunity, oracle?: typeof RISK_ORACLE[string]): number {
  if (!oracle) {
    // Unknown protocol — maximum risk
    return 85;
  }

  let score = 0;

  // Audit quality (30% weight)
  if (!proposal.audited) score += 40;
  else score += (100 - oracle.auditScore) * 0.30;

  // Volatility (25% weight)
  score += oracle.volatility * 0.25;

  // TVL drop (20% weight)
  score += oracle.tvlDropPct * 0.20;

  // Incident history (25% weight)
  if (oracle.incidents > 0) score += 25;

  // APY anomaly check — suspiciously high APY is a red flag
  if (proposal.apy > 25 && proposal.tvl < 1_000_000) score += 10;

  return Math.min(Math.round(score), 100);
}

function buildRiskReasons(
  proposal: YieldOpportunity,
  oracle: typeof RISK_ORACLE[string] | undefined,
  score: number
): string[] {
  const reasons: string[] = [];

  if (!proposal.audited) reasons.push('Contract is UNAUDITED — no independent security review');
  if (oracle?.incidents && oracle.incidents > 0) reasons.push(`${oracle.incidents} historical exploit(s) detected`);
  if (proposal.apy > 25) reasons.push(`Anomalously high APY (${proposal.apy.toFixed(1)}%) suggests unsustainable emissions`);
  if (proposal.tvl < 1_000_000) reasons.push(`Low TVL ($${(proposal.tvl / 1000).toFixed(0)}K) limits exit liquidity`);
  if (oracle?.tvlDropPct && oracle.tvlDropPct > 20) reasons.push(`TVL dropped ${oracle.tvlDropPct}% from peak — possible confidence loss`);
  if (oracle?.volatility && oracle.volatility > 50) reasons.push(`High price volatility score: ${oracle.volatility}/100`);
  if (score < 40) reasons.push('All security checks passed');

  return reasons;
}

function buildVetoMessage(proposal: YieldOpportunity, assessment: RiskAssessment): string {
  return (
    `🚫 **VETO ISSUED** — ${proposal.protocol}: ${proposal.pool}\n\n` +
    `Risk Score: ${assessment.riskScore}/100 (threshold: ${VETO_THRESHOLD})\n` +
    `Exploit Probability: ${((assessment.exploitProbability || 0) * 100).toFixed(1)}%\n\n` +
    `Risk Factors:\n${assessment.reasons.map((r) => `• ${r}`).join('\n')}\n\n` +
    `This proposal requires debate before approval.`
  );
}

export function buildDebateCounterpoints(assessment: RiskAssessment): string[] {
  return assessment.reasons.slice(0, 3).map((r) => r);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
