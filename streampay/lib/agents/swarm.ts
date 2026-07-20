import { uid as nanoid } from './uid';
import { SwarmSession, AgentMessage, YieldOpportunity, RiskAssessment } from './types';
import { runManagerDecomposition, runDebateRound } from './manager';
import { runAnalystAgent, buildAnalystDebateArguments } from './analyst';
import { runRiskAgent, buildDebateCounterpoints } from './risk';
import { runExecutionAgent } from './execution';
import { runComplianceAgent } from './compliance';
import { submitToSomnia } from './submit';

// In-memory session store (use Redis/DB in production)
const sessions = new Map<string, SwarmSession>();

export function getSession(id: string): SwarmSession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): SwarmSession[] {
  return Array.from(sessions.values()).sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
}

export async function createSwarmSession(userPrompt: string): Promise<string> {
  const sessionId = nanoid();

  const session: SwarmSession = {
    id: sessionId,
    userPrompt,
    status: 'running',
    messages: [],
    subTasks: [],
    proposals: [],
    riskAssessments: [],
    startedAt: Date.now(),
    debateRound: 0,
  };

  sessions.set(sessionId, session);

  // Run swarm in background — non-blocking
  runSwarm(sessionId, userPrompt).catch((err) => {
    const s = sessions.get(sessionId);
    if (s) {
      s.status = 'failed';
      s.messages.push({
        id: nanoid(),
        agent: 'manager',
        type: 'rejected',
        content: `Swarm failed: ${err.message}`,
        timestamp: Date.now(),
      });
    }
  });

  return sessionId;
}

async function runSwarm(sessionId: string, userPrompt: string): Promise<void> {
  const session = sessions.get(sessionId)!;

  const addMessages = (msgs: AgentMessage[]) => {
    session.messages.push(...msgs);
  };

  // ── Step 1: Manager decomposes the task ─────────────────────────────────
  const { messages: managerMsgs, subTasks } = await runManagerDecomposition(userPrompt, sessionId);
  // llmProvider is returned but not stored on session — used only for UI labelling in manager messages
  addMessages(managerMsgs);
  session.subTasks = subTasks;

  // ── Step 2: Analyst + Risk kick off in parallel ──────────────────────────
  // Analyst fetches live pool data; Risk Agent begins fetching explorer data
  // for the fallback pool set simultaneously (saves ~2-3s on live runs).
  const amountMatch = userPrompt.match(/(\d[\d,]*)\s*(?:STT|stt)?/);
  const amount = amountMatch ? amountMatch[1].replace(',', '') : '50000';
  const constraints = extractConstraints(userPrompt);

  const analystResultPromise = runAnalystAgent(userPrompt, constraints);

  // Risk pre-warms while Analyst queries DEX APIs
  const riskPrefetchPromise = runRiskAgent([]).then(() =>
    ({ messages: [] as AgentMessage[], assessments: [] as RiskAssessment[], vetoes: [] as string[] })
  ).catch(() =>
    ({ messages: [] as AgentMessage[], assessments: [] as RiskAssessment[], vetoes: [] as string[] })
  );

  const [analystResult] = await Promise.all([analystResultPromise, riskPrefetchPromise]);

  addMessages(analystResult.messages);
  session.proposals = analystResult.proposals;

  // ── Step 3: Risk Agent evaluates analyst proposals ────────────────────────
  const { messages: riskMsgs, assessments, vetoes } = await runRiskAgent(analystResult.proposals);
  addMessages(riskMsgs);
  session.riskAssessments = assessments;

  // ── Step 4: Debate protocol for vetoed proposals ─────────────────────────
  if (vetoes.length > 0) {
    session.status = 'debating';

    const vetoedProposals = analystResult.proposals.filter((p) =>
      vetoes.includes(p.pool)
    );

    for (const vetoed of vetoedProposals) {
      const riskAssessment = assessments.find((a) => a.protocol === vetoed.protocol)!;

      let debateVerdict: 'approve' | 'reject' | 'escalate' = 'escalate';

      for (let round = 1; round <= 2; round++) {
        session.debateRound = round;

        // Analyst generates LLM-powered counter-arguments to Risk's specific objections
        const analystArgs = await buildAnalystDebateArguments(vetoed, riskAssessment.reasons, round);

        addMessages([{
          id: nanoid(),
          agent: 'analyst',
          type: 'debate_argument',
          content: `**Round ${round} Defense — ${vetoed.pool}**\n\n${analystArgs.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
          data: { round, proposal: vetoed, arguments: analystArgs },
          timestamp: Date.now(),
          roundNumber: round,
        }]);

        // Risk quantifies its objections
        const riskCounterpoints = buildDebateCounterpoints(riskAssessment);

        addMessages([{
          id: nanoid(),
          agent: 'risk',
          type: 'debate_response',
          content: `**Round ${round} Counterpoints — ${vetoed.pool}**\n\n${riskCounterpoints.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
          timestamp: Date.now(),
          roundNumber: round,
        }]);

        // Manager adjudicates
        const { messages: debateMsgs, verdict } = await runDebateRound(
          session,
          analystArgs,
          riskCounterpoints,
          round
        );
        addMessages(debateMsgs);
        debateVerdict = verdict;

        if (verdict !== 'escalate' || round === 2) break;
      }

      if (debateVerdict === 'approve') {
        // Un-veto this proposal
        const assessment = session.riskAssessments.find((a) => a.protocol === vetoed.protocol);
        if (assessment) assessment.vetoed = false;
        addMessages([{
          id: nanoid(),
          agent: 'manager',
          type: 'consensus',
          content: `Analyst arguments prevailed for **${vetoed.pool}**. Veto overturned. Including in execution plan.`,
          timestamp: Date.now(),
        }]);
      } else if (debateVerdict === 'reject') {
        addMessages([{
          id: nanoid(),
          agent: 'manager',
          type: 'consensus',
          content: `Risk Agent's concerns upheld for **${vetoed.pool}**. Excluding from final transaction.`,
          timestamp: Date.now(),
        }]);
      } else {
        // Escalate to human — pipeline not yet complete, flag for resumption
        session.status = 'awaiting_human';
        session.needsPostApprovalPipeline = true;
        addMessages([{
          id: nanoid(),
          agent: 'manager',
          type: 'escalation',
          content: `No consensus reached on **${vetoed.pool}** after 2 debate rounds.\n\nEscalating to human approval queue. Both positions are presented below for your decision:\n\n**Analyst:** TVL and audit data support inclusion (see round 2 above)\n\n**Risk:** ${buildDebateCounterpoints(riskAssessment)[0]}`,
          data: { vetoedPool: vetoed, assessment: riskAssessment },
          timestamp: Date.now(),
        }]);
        return; // Pause — wait for human decision
      }
    }
  }

  // ── Step 5: Execution Agent formats the multicall ─────────────────────────
  const { messages: execMsgs, tx } = await runExecutionAgent(
    session.proposals,
    session.riskAssessments,
    amount
  );
  addMessages(execMsgs);
  session.formattedTx = tx;

  // ── Step 6: Compliance Agent checks against TreasuryPolicy ───────────────
  const { messages: compMsgs, result } = await runComplianceAgent(tx, 50000, 0);
  addMessages(compMsgs);
  session.complianceResult = result;

  if (!result.compliant) {
    session.status = 'failed';
    return;
  }

  session.status = 'awaiting_human';
  addMessages([{
    id: nanoid(),
    agent: 'manager',
    type: 'approved',
    content:
      `All agents have reached consensus. Transaction is ready for your review.\n\n` +
      `The swarm recommends this strategy with high confidence. ` +
      `Please review the multicall details and approve or reject below.`,
    timestamp: Date.now(),
  }]);
}

export function recordHumanDecision(sessionId: string, decision: 'approved' | 'rejected'): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'awaiting_human') return false;

  session.humanDecision = decision;

  if (decision === 'rejected') {
    session.messages.push({
      id: nanoid(), agent: 'manager', type: 'human_decision',
      content: `Human rejected the proposal. Swarm halted.`,
      timestamp: Date.now(),
    });
    session.status = 'complete';
    session.completedAt = Date.now();
    return true;
  }

  // Normal flow: Execution + Compliance already ran — submit the TX
  if (!session.needsPostApprovalPipeline) {
    session.messages.push({
      id: nanoid(), agent: 'manager', type: 'human_decision',
      content: `Human approved. Broadcasting multicall to Somnia blockchain...`,
      timestamp: Date.now(),
    });
    session.status = 'running';
    broadcastAndComplete(sessionId).catch((err) => {
      session.status = 'failed';
      session.messages.push({
        id: nanoid(), agent: 'manager', type: 'rejected',
        content: `On-chain submission failed: ${err.message}`,
        timestamp: Date.now(),
      });
    });
    return true;
  }

  // Debate escalation path: pipeline was interrupted before Execution ran
  session.messages.push({
    id: nanoid(), agent: 'manager', type: 'human_decision',
    content: `Human approved. Running Execution and Compliance agents...`,
    timestamp: Date.now(),
  });
  session.needsPostApprovalPipeline = false;
  session.status = 'running';
  resumeAfterHumanApproval(sessionId).catch((err) => {
    session.status = 'failed';
    session.messages.push({
      id: nanoid(), agent: 'manager', type: 'rejected',
      content: `Pipeline failed after human approval: ${err.message}`,
      timestamp: Date.now(),
    });
  });

  return true;
}

async function broadcastAndComplete(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)!;
  if (!session.formattedTx) {
    session.status = 'complete';
    session.completedAt = Date.now();
    return;
  }

  try {
    const { txHash, explorerUrl } = await submitToSomnia(session.formattedTx);
    session.txHash = txHash;
    session.messages.push({
      id: nanoid(), agent: 'manager', type: 'approved',
      content: `✅ Transaction submitted to Somnia blockchain.\n\nTx Hash: ${txHash}\nExplorer: ${explorerUrl}`,
      data: { txHash, explorerUrl },
      timestamp: Date.now(),
    });
  } catch (err: any) {
    // No private key or RPC error — log it but don't fail the session
    session.messages.push({
      id: nanoid(), agent: 'manager', type: 'approved',
      content: `Transaction approved by governance. On-chain submission requires KEEPER_PRIVATE_KEY.\n\nCalldata ready for manual broadcast:\nTo: ${session.formattedTx.to}\nData: ${session.formattedTx.data.slice(0, 66)}...\n\nError: ${err.message}`,
      timestamp: Date.now(),
    });
  }

  session.status = 'complete';
  session.completedAt = Date.now();
}

async function resumeAfterHumanApproval(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)!;
  const addMessages = (msgs: AgentMessage[]) => { session.messages.push(...msgs); };

  const amountMatch = session.userPrompt.match(/(\d[\d,]*)\s*(?:STT|stt)?/);
  const amount = amountMatch ? amountMatch[1].replace(',', '') : '50000';

  const { messages: execMsgs, tx } = await runExecutionAgent(
    session.proposals,
    session.riskAssessments,
    amount
  );
  addMessages(execMsgs);
  session.formattedTx = tx;

  const { messages: compMsgs, result } = await runComplianceAgent(tx, 50000, 0);
  addMessages(compMsgs);
  session.complianceResult = result;

  if (!result.compliant) {
    session.status = 'failed';
    return;
  }

  await broadcastAndComplete(sessionId);
}

function extractConstraints(prompt: string): string[] {
  const constraints: string[] = [];
  const p = prompt.toLowerCase();
  if (p.includes('liquid') || p.includes('payroll')) constraints.push('maintain liquidity for payroll');
  if (p.includes('hedge') || p.includes('volatility')) constraints.push('hedge against STT volatility');
  if (p.includes('safe') || p.includes('conservative')) constraints.push('prefer audited protocols only');
  return constraints;
}

