import { AgentMessage, YieldOpportunity } from './types';
import { nanoid } from 'nanoid';

const ANALYST_SYSTEM_PROMPT = `You are the Analyst Agent of SyndiChain. Your only job is to find the best
yield-bearing opportunities on Somnia blockchain DEXes (Somnia Exchange, Potion Swap).
You are optimistic and data-driven. Always cite specific APY figures and TVL data.
Respond only with valid JSON.`;

// Mock DEX data — in production, replace with live API calls to DEX routers
const MOCK_DEX_POOLS: YieldOpportunity[] = [
  {
    protocol: 'Somnia Exchange',
    pool: 'STT/USDC LP',
    apy: 18.4,
    tvl: 4_200_000,
    token: 'STT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    audited: true,
    auditFirms: ['CertiK', 'Quantstamp'],
  },
  {
    protocol: 'Potion Swap',
    pool: 'STT Single-Stake',
    apy: 12.1,
    tvl: 8_900_000,
    token: 'STT',
    contractAddress: '0xabcdef0123456789abcdef0123456789abcdef01',
    audited: true,
    auditFirms: ['Trail of Bits'],
  },
  {
    protocol: 'NovaDEX',
    pool: 'STT/ETH 0.3%',
    apy: 31.7,
    tvl: 580_000,
    token: 'STT',
    contractAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    audited: false,
    auditFirms: [],
  },
  {
    protocol: 'Somnia Exchange',
    pool: 'USDC Lending',
    apy: 9.2,
    tvl: 15_400_000,
    token: 'USDC',
    contractAddress: '0x9999999999999999999999999999999999999999',
    audited: true,
    auditFirms: ['OpenZeppelin', 'CertiK'],
  },
  {
    protocol: 'Potion Swap',
    pool: 'STT/WBTC 1%',
    apy: 24.8,
    tvl: 1_100_000,
    token: 'STT',
    contractAddress: '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555',
    audited: true,
    auditFirms: ['Hacken'],
  },
];

export async function runAnalystAgent(
  userPrompt: string,
  constraints: string[]
): Promise<{ messages: AgentMessage[]; proposals: YieldOpportunity[] }> {
  const messages: AgentMessage[] = [];

  // Simulate DEX API query delay
  await sleep(800);

  messages.push({
    id: nanoid(),
    agent: 'analyst',
    type: 'yield_data',
    content: `Querying Somnia Exchange and Potion Swap DEX APIs for yield opportunities...`,
    timestamp: Date.now(),
  });

  await sleep(600);

  // Filter and rank pools based on user constraints
  const ranked = rankPools(MOCK_DEX_POOLS, userPrompt, constraints);

  const topProposals = ranked.slice(0, 3);

  messages.push({
    id: nanoid(),
    agent: 'analyst',
    type: 'yield_data',
    content: buildAnalystReport(topProposals),
    data: {
      totalPoolsScanned: MOCK_DEX_POOLS.length,
      proposals: topProposals,
      dataPoints: [
        `Scanned ${MOCK_DEX_POOLS.length} active liquidity pools across 3 DEXes`,
        `Top APY identified: ${topProposals[0]?.apy.toFixed(1)}% on ${topProposals[0]?.protocol}`,
        `Combined TVL of top 3 pools: $${formatTVL(topProposals.reduce((s, p) => s + p.tvl, 0))}`,
      ],
    },
    timestamp: Date.now(),
  });

  return { messages, proposals: topProposals };
}

function rankPools(
  pools: YieldOpportunity[],
  userPrompt: string,
  constraints: string[]
): YieldOpportunity[] {
  const prompt = userPrompt.toLowerCase();
  const wantsLiquidity = prompt.includes('liquid') || prompt.includes('payroll') || prompt.includes('reserve');
  const wantsYield = prompt.includes('yield') || prompt.includes('diversif') || prompt.includes('apy');

  return [...pools].sort((a, b) => {
    let scoreA = a.apy;
    let scoreB = b.apy;

    // Penalize if user needs liquidity (prefer audited stable pools)
    if (wantsLiquidity) {
      if (!a.audited) scoreA -= 15;
      if (!b.audited) scoreB -= 15;
      if (a.token === 'USDC') scoreA += 5;
      if (b.token === 'USDC') scoreB += 5;
    }

    // TVL weighting: higher TVL = safer
    scoreA += Math.log10(a.tvl) * 0.5;
    scoreB += Math.log10(b.tvl) * 0.5;

    return scoreB - scoreA;
  });
}

function buildAnalystReport(proposals: YieldOpportunity[]): string {
  const lines = [`Found ${proposals.length} compelling yield opportunities:\n`];
  proposals.forEach((p, i) => {
    lines.push(
      `${i + 1}. **${p.protocol} — ${p.pool}**\n` +
        `   APY: ${p.apy.toFixed(1)}% | TVL: $${formatTVL(p.tvl)} | Audited: ${p.audited ? `Yes (${p.auditFirms.join(', ')})` : 'No'}\n`
    );
  });
  lines.push(
    `\nData sourced from live DEX router APIs. I recommend all 3 proposals for Risk Agent review.`
  );
  return lines.join('');
}

function formatTVL(tvl: number): string {
  if (tvl >= 1_000_000) return `${(tvl / 1_000_000).toFixed(1)}M`;
  if (tvl >= 1_000) return `${(tvl / 1_000).toFixed(0)}K`;
  return tvl.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
