import { AgentMessage, SubTask, SwarmSession } from './types';
import { uid as nanoid } from './uid';

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
): Promise<{ messages: AgentMessage[]; subTasks: SubTask[] }> {
  const messages: AgentMessage[] = [];

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
    {
      "id": "task-1",
      "assignedTo": "analyst",
      "description": "specific task for analyst",
      "priority": "high"
    }
  ],
  "constraints": ["list of hard constraints extracted from user goal"],
  "liquidityRequirement": 0
}`;

  try {
    const response = await callLLM(MANAGER_SYSTEM_PROMPT, decompositionPrompt, 'fast');
    const parsed = JSON.parse(extractJSON(response));

    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'task_decomposition',
      content: `Analyzing goal: "${userPrompt}"\n\nDecomposed into ${parsed.subTasks.length} parallel tasks. Constraints identified: ${parsed.constraints?.join(', ') || 'none'}.`,
      data: parsed,
      timestamp: Date.now(),
    });

    return { messages, subTasks: parsed.subTasks || [] };
  } catch (err) {
    // Fallback decomposition when LLM is unavailable
    const subTasks: SubTask[] = [
      { id: 'task-1', assignedTo: 'analyst', description: `Find yield opportunities for: ${userPrompt}`, priority: 'high' },
      { id: 'task-2', assignedTo: 'risk', description: 'Assess risk for all proposed opportunities', priority: 'high' },
      { id: 'task-3', assignedTo: 'execution', description: 'Format approved strategy as multicall', priority: 'medium' },
      { id: 'task-4', assignedTo: 'compliance', description: 'Verify against TreasuryPolicy limits', priority: 'high' },
    ];

    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'task_decomposition',
      content: `Decomposing treasury goal into ${subTasks.length} parallel sub-tasks for the swarm.`,
      data: { subTasks, constraints: [], summary: userPrompt },
      timestamp: Date.now(),
    });

    return { messages, subTasks };
  }
}

export async function runDebateRound(
  session: SwarmSession,
  analystArguments: string[],
  riskCounterpoints: string[],
  roundNumber: number
): Promise<{ messages: AgentMessage[]; verdict: 'approve' | 'reject' | 'escalate' }> {
  const messages: AgentMessage[] = [];

  const debatePrompt = `
You are mediating a debate between an Analyst Agent and a Risk Agent about a DeFi investment proposal.

Round: ${roundNumber} of 2

ANALYST's arguments (why this opportunity is safe):
${analystArguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

RISK AGENT's counterpoints:
${riskCounterpoints.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${roundNumber >= 2 ? 'This is the FINAL round. You MUST render a verdict.' : ''}

Evaluate the arguments and respond with JSON:
{
  "verdict": "approve" | "reject" | "escalate",
  "reasoning": "your decision rationale",
  "confidence": 0-100,
  "winningAgent": "analyst" | "risk" | "tie"
}

Rules:
- "approve" if analyst arguments significantly outweigh risks
- "reject" if risk is clearly too high
- "escalate" if genuinely tied after round 2 (human must decide)`;

  try {
    const response = await callLLM(MANAGER_SYSTEM_PROMPT, debatePrompt, 'reasoning');
    const parsed = JSON.parse(extractJSON(response));

    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: roundNumber >= 2 ? 'consensus' : 'debate_response',
      content: `Round ${roundNumber} verdict: **${parsed.verdict.toUpperCase()}** (confidence: ${parsed.confidence}%)\n\n${parsed.reasoning}`,
      data: parsed,
      timestamp: Date.now(),
      roundNumber,
    });

    return { messages, verdict: parsed.verdict };
  } catch {
    // Escalate on error to be safe
    messages.push({
      id: nanoid(),
      agent: 'manager',
      type: 'escalation',
      content: `Unable to reach consensus after ${roundNumber} debate round(s). Escalating to human for final decision.`,
      timestamp: Date.now(),
      roundNumber,
    });
    return { messages, verdict: 'escalate' };
  }
}

async function callLLM(system: string, user: string, mode: 'fast' | 'reasoning'): Promise<string> {
  // Use Anthropic Claude via API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No LLM API key configured');

  const model = mode === 'reasoning' ? 'claude-sonnet-5' : 'claude-haiku-4-5-20251001';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) throw new Error(`LLM call failed: ${response.status}`);
  const data = await response.json();
  return data.content[0].text;
}

function extractJSON(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return match[0];
}
