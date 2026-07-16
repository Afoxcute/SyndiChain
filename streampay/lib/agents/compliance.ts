import { AgentMessage, FormattedTransaction, ComplianceResult } from './types';
import { nanoid } from 'nanoid';

// Mock TreasuryPolicy limits (mirrors TreasuryPolicy.sol)
const POLICY = {
  dailyTransferLimit: 10_000, // STT
  singleTxLimit: 5_000,       // STT
  minLiquidityReserve: 1_000, // STT
  multisigThreshold: 2_000,   // STT — requires human approval above this
};

const ALLOWLISTED_PROTOCOLS = new Set([
  '0x1234567890123456789012345678901234567890', // Somnia Exchange STT/USDC LP
  '0xabcdef0123456789abcdef0123456789abcdef01', // Potion Swap STT Single-Stake
  '0x9999999999999999999999999999999999999999', // Somnia Exchange USDC Lending
  '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555', // Potion Swap STT/WBTC
]);

export async function runComplianceAgent(
  tx: FormattedTransaction,
  treasuryBalance: number,
  dailySpent: number
): Promise<{ messages: AgentMessage[]; result: ComplianceResult }> {
  const messages: AgentMessage[] = [];

  await sleep(400);

  messages.push({
    id: nanoid(),
    agent: 'compliance',
    type: 'compliance_check',
    content: `Verifying transaction against TreasuryPolicy.sol on Somnia Testnet...`,
    timestamp: Date.now(),
  });

  await sleep(600);

  const txAmountSTT = Number(BigInt(tx.value) / BigInt(1e18));

  const checks = [
    {
      name: 'Protocol Allowlist',
      passed: tx.calls.every(
        (c) => c.target === '0x0000000000000000000000000000000000000000' || ALLOWLISTED_PROTOCOLS.has(c.target)
      ),
      detail: `All target contracts on allowlist: ${ALLOWLISTED_PROTOCOLS.size} approved protocols`,
    },
    {
      name: 'Single Transaction Limit',
      passed: txAmountSTT <= POLICY.singleTxLimit,
      detail: `${txAmountSTT.toLocaleString()} STT vs limit of ${POLICY.singleTxLimit.toLocaleString()} STT`,
    },
    {
      name: 'Daily Transfer Limit',
      passed: dailySpent + txAmountSTT <= POLICY.dailyTransferLimit,
      detail: `Daily used: ${dailySpent.toLocaleString()} + ${txAmountSTT.toLocaleString()} = ${(dailySpent + txAmountSTT).toLocaleString()} STT (limit: ${POLICY.dailyTransferLimit.toLocaleString()})`,
    },
    {
      name: 'Minimum Liquidity Reserve',
      passed: treasuryBalance - txAmountSTT >= POLICY.minLiquidityReserve,
      detail: `Post-tx balance: ${(treasuryBalance - txAmountSTT).toLocaleString()} STT (min: ${POLICY.minLiquidityReserve.toLocaleString()} STT)`,
    },
    {
      name: 'Multicall Structure',
      passed: tx.calls.length > 0 && tx.calls.length <= 10,
      detail: `${tx.calls.length} call(s) in batch — within safe limits`,
    },
  ];

  const failedChecks = checks.filter((c) => !c.passed);
  const compliant = failedChecks.length === 0;
  const requiresHuman = txAmountSTT >= POLICY.multisigThreshold;

  const result: ComplianceResult = {
    compliant,
    reason: compliant
      ? requiresHuman
        ? `All policy checks passed. Amount (${txAmountSTT.toLocaleString()} STT) exceeds multisig threshold — human approval required.`
        : 'All policy checks passed. Transaction is cleared for execution.'
      : `Failed ${failedChecks.length} policy check(s): ${failedChecks.map((c) => c.name).join(', ')}`,
    checks,
  };

  messages.push({
    id: nanoid(),
    agent: 'compliance',
    type: 'compliance_check',
    content: buildComplianceReport(result, requiresHuman),
    data: { result, requiresHuman, txAmountSTT },
    timestamp: Date.now(),
  });

  return { messages, result };
}

function buildComplianceReport(result: ComplianceResult, requiresHuman: boolean): string {
  const lines: string[] = ['**TreasuryPolicy.sol Compliance Report**\n'];

  result.checks.forEach((c) => {
    lines.push(`${c.passed ? '✅' : '❌'} ${c.name}: ${c.detail}`);
  });

  lines.push('');
  lines.push(result.compliant ? '✅ **COMPLIANT**' : '❌ **NON-COMPLIANT**');
  lines.push(result.reason);

  if (requiresHuman && result.compliant) {
    lines.push(
      '\n⚠️ Amount exceeds multisig threshold. Routing to human approval queue via StreamPay dashboard.'
    );
  }

  return lines.join('\n');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
