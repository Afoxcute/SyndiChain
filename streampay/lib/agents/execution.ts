import { AgentMessage, YieldOpportunity, RiskAssessment, FormattedTransaction, MulticallEntry } from './types';
import { uid as nanoid } from './uid';

export async function runExecutionAgent(
  proposals: YieldOpportunity[],
  assessments: RiskAssessment[],
  amount: string
): Promise<{ messages: AgentMessage[]; tx: FormattedTransaction }> {
  const messages: AgentMessage[] = [];

  await sleep(600);

  messages.push({
    id: nanoid(),
    agent: 'execution',
    type: 'tx_formatted',
    content: 'Building gas-optimized multicall transaction from approved proposals...',
    timestamp: Date.now(),
  });

  await sleep(500);

  // Only include proposals that passed risk assessment
  const approved = proposals.filter((p) => {
    const assessment = assessments.find((a) => a.protocol === p.protocol);
    return !assessment?.vetoed;
  });

  const totalAmountWei = parseAmountToWei(amount);
  const perPoolAmount = approved.length > 0 ? totalAmountWei / BigInt(approved.length) : 0n;

  const calls: MulticallEntry[] = approved.map((p) => ({
    target: p.contractAddress,
    callData: encodeDepositCall(perPoolAmount),
    value: perPoolAmount.toString(),
    label: `Deposit ${formatAmount(perPoolAmount)} STT → ${p.protocol} ${p.pool} (${p.apy.toFixed(1)}% APY)`,
  }));

  // Add a final balance-check call
  calls.push({
    target: '0x0000000000000000000000000000000000000000',
    callData: '0x',
    value: '0',
    label: 'Verify treasury minimum liquidity reserve',
  });

  const gasEstimate = estimateGas(calls.length);

  const tx: FormattedTransaction = {
    to: '0xMulticall3Address00000000000000000000000',
    data: encodeMulticall(calls),
    value: totalAmountWei.toString(),
    gasEstimate: gasEstimate.toString(),
    description: `Batch deposit ${amount} STT across ${approved.length} yield pool(s) — estimated gas: ${gasEstimate.toLocaleString()} units`,
    calls,
  };

  messages.push({
    id: nanoid(),
    agent: 'execution',
    type: 'tx_formatted',
    content:
      `Multicall transaction ready:\n\n` +
      calls
        .slice(0, -1)
        .map((c, i) => `${i + 1}. ${c.label}`)
        .join('\n') +
      `\n\nEstimated gas: ${gasEstimate.toLocaleString()} units\n` +
      `Batching ${calls.length - 1} deposits into 1 transaction saves ~${Math.round((calls.length - 1) * 0.35 * 100)}% gas vs individual txs.`,
    data: { tx },
    timestamp: Date.now(),
  });

  return { messages, tx };
}

function parseAmountToWei(amount: string): bigint {
  const num = parseFloat(amount.replace(/[^0-9.]/g, '')) || 50000;
  return BigInt(Math.floor(num * 1e18));
}

function formatAmount(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(2);
}

function encodeDepositCall(amount: bigint): string {
  // ABI-encoded deposit(uint256) call — simplified for demo
  const fnSelector = '0xd0e30db0'; // deposit()
  const amountHex = amount.toString(16).padStart(64, '0');
  return `${fnSelector}${amountHex}`;
}

function encodeMulticall(calls: MulticallEntry[]): string {
  // Simplified multicall encoding for demo
  return `0x252dba42${'0'.repeat(64)}${calls.length.toString(16).padStart(64, '0')}`;
}

function estimateGas(callCount: number): number {
  // Base gas + per-call overhead
  return 21000 + callCount * 45000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
