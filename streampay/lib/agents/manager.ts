import { AgentMessage, SubTask, SwarmSession } from './types';
import { uid as nanoid } from './uid';
import { callLLM, extractJSON, activeLLMProvider } from './llm';

const MANAGER_SYSTEM_PROMPT = `You are the Manager Agent of SyndiChain, an autonomous DAO Treasury Swarm.
Your role is to:
1. Parse complex treasury management goals from the user
2. Decompose them into parallel sub-tasks for specialist agents
3. Orchestrate debate rounds when agents disagree
4. Make final routing decisions

Always respond with structured JSON. Be concise but precise.`;

export async function runManagerDecomposition(
  userPrompt: string,
  sessionId: string
): Promise<{ messages: AgentMessage[]; subTasks: SubTask[]; llmProvider: string }> {
  const messages: AgentMessage[] = [];
  const provider = activeLLMProvider();

  const decompositionPrompt = `
User treasury goal: "${userPrompt}"

Decompose this into sub-tasks for the following agents:
- analyst: Find yield opportunities matching the user's goal
- risk: Evaluate security and risk of proposed opportunities
- execution: Format the approved strategy as a gas-optimized multicall
- compliance: Verify the transaction against TreasuryPolicy rules

Respond with JSON in this exact format:
{
  "summary": "one-sentence summary of the goal",
  "subTasks": [
    { "id": "task-1", "assignedTo": "analyst", "description": "...", "priority": "high" },
    { "id": "task-2", "assignedTo": "risk",    "description": "...", "priority": "high" },
    { "id": "task-3", "assignedTo": "execution","description": "...", "priority": "medium" },
    { "id": "task-4", "assignedTo": "compliance","description": "...","priority": "high" }
  ],
  "constraints": ["hard constraints extracted from user goal"],
  "liquidityRequirement": 0
}`;

  try {
    const response = await callLLM(MANAGER_SYSTEM_PROMPT, decompositionPrompt, 'reasoning');
    const parsed = JSON.parse(extractJSON(response));

    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'task_decomposition',
      content:
        `[${provider === 'qwen' ? 'Qwen-Plus' : provider === 'claude' ? 'Claude Sonnet' : 'LLM'} reasoning]\n\n` +
        `Analyzing: "${userPrompt}"\n\n` +
        `Decomposed into ${parsed.subTasks?.length ?? 4} parallel tasks.\n` +
        `Constraints identified: ${parsed.constraints?.join(', ') || 'none'}\n` +
        `Summary: ${parsed.summary}`,
      data: parsed,
      timestamp: Date.now(),
    });

    return { messages, subTasks: parsed.subTasks ?? defaultSubTasks(userPrompt), llmProvider: provider };
  } catch (err: any) {
    const subTasks = defaultSubTasks(userPrompt);
    const errMsg = err?.message ?? String(err);
    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'task_decomposition',
      content:
        `[Fallback decomposition — LLM call failed]\n\n` +
        `Error: ${errMsg}\n\n` +
        `Decomposing "${userPrompt}" into ${subTasks.length} parallel sub-tasks for the swarm.`,
      data: { subTasks, constraints: [], summary: userPrompt, error: errMsg },
      timestamp: Date.now(),
    });
    return { messages, subTasks, llmProvider: 'none' };
  }
}

export async function runDebateRound(
  session: SwarmSession,
  analystArguments: string[],
  riskCounterpoints: string[],
  roundNumber: number
): Promise<{ messages: AgentMessage[]; verdict: 'approve' | 'reject' | 'escalate' }> {
  const messages: AgentMessage[] = [];
  const provider = activeLLMProvider();

  const debatePrompt = `
You are mediating a structured debate between an Analyst Agent and a Risk Agent
about a contested DeFi investment proposal. You must be rigorous and impartial.

Round: ${roundNumber} of 2

ANALYST's arguments (why this opportunity is safe):
${analystArguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

RISK AGENT's counterpoints (why it is dangerous):
${riskCounterpoints.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${roundNumber >= 2
  ? 'This is the FINAL round. You MUST render a definitive verdict — no further debate is possible.'
  : 'After this round there is one more debate round if needed.'}

Evaluate the strength of each argument and respond with JSON only:
{
  "verdict": "approve" | "reject" | "escalate",
  "reasoning": "2-3 sentence rationale citing the strongest arguments",
  "confidence": 0-100,
  "winningAgent": "analyst" | "risk" | "tie"
}

Rules:
- "approve"  → analyst arguments clearly outweigh the risks
- "reject"   → risk concerns are material and unresolvable
- "escalate" → arguments are genuinely balanced; human must break the tie (only valid on round 2)`;

  try {
    const response = await callLLM(MANAGER_SYSTEM_PROMPT, debatePrompt, 'reasoning');
    const parsed = JSON.parse(extractJSON(response));

    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: roundNumber >= 2 ? 'consensus' : 'debate_response',
      content:
        `[${provider === 'qwen' ? 'Qwen-Plus' : 'Claude Sonnet'} arbitration — Round ${roundNumber}]\n\n` +
        `Verdict: **${String(parsed.verdict).toUpperCase()}** (confidence: ${parsed.confidence}%)\n\n` +
        `${parsed.reasoning}`,
      data: parsed,
      timestamp: Date.now(),
      roundNumber,
    });

    return { messages, verdict: parsed.verdict };
  } catch {
    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'escalation',
      content: `LLM arbitration unavailable after round ${roundNumber}. Escalating to human for safety.`,
      timestamp: Date.now(),
      roundNumber,
    });
    return { messages, verdict: 'escalate' };
  }
}

function defaultSubTasks(userPrompt: string): SubTask[] {
  return [
    { id: 'task-1', assignedTo: 'analyst',    description: `Query Somnia DEX APIs for yield opportunities matching: ${userPrompt}`, priority: 'high' },
    { id: 'task-2', assignedTo: 'risk',       description: 'Assess security risk for all proposed pools via Shannon Explorer + Risk Oracle', priority: 'high' },
    { id: 'task-3', assignedTo: 'execution',  description: 'Format approved strategy as Multicall3 gas-optimized transaction', priority: 'medium' },
    { id: 'task-4', assignedTo: 'compliance', description: 'Verify tx against TreasuryPolicy.sol daily limits and allowlists', priority: 'high' },
  ];
}
