import OpenAI from 'openai';

export interface Stream {
  id: number;
  priority: 'high' | 'medium' | 'low';
  reward: number;
  flowRate: bigint;
}

export interface BatchOptimizationResult {
  isProfitable: boolean;
  totalProfit: number;
  decision: string;
  batches: {
    streamIds: number[];
    count: number;
    reason: string;
  }[];
}

const MAX_BATCH_SIZE = 200;

function buildBatchesByPriority(streams: Stream[]): BatchOptimizationResult['batches'] {
  const ordered = [
    ...streams.filter((s) => s.priority === 'high'),
    ...streams.filter((s) => s.priority === 'medium'),
    ...streams.filter((s) => s.priority === 'low'),
  ];

  const batches: BatchOptimizationResult['batches'] = [];
  for (let i = 0; i < ordered.length; i += MAX_BATCH_SIZE) {
    const chunk = ordered.slice(i, i + MAX_BATCH_SIZE);
    batches.push({
      streamIds: chunk.map((s) => s.id),
      count: chunk.length,
      reason: `Batch ${batches.length + 1} — priority-ordered streams`,
    });
  }
  return batches;
}

export async function optimizeBatching(
  pendingStreams: Stream[],
  gasPrice: bigint,
  rewardPerStream: number,
  ethPrice: number = 2000,
  sttPrice: number = 1
): Promise<BatchOptimizationResult> {
  if (pendingStreams.length === 0) {
    return { isProfitable: false, totalProfit: 0, decision: 'No streams to update', batches: [] };
  }

  const qwenKey = process.env.QWEN_API_KEY;

  // Without Qwen key: always execute — on testnet keeping balances current is the priority
  if (!qwenKey) {
    const batches = buildBatchesByPriority(pendingStreams);
    return {
      isProfitable: true,
      totalProfit: 0,
      decision: `Updating ${pendingStreams.length} stream(s) in ${batches.length} batch(es) [no-AI mode]`,
      batches,
    };
  }

  const baseGasPerBatch = 50_000;
  const costPerBatchUSD = (Number(gasPrice) * baseGasPerBatch * ethPrice) / 1e18;
  const revenueUSD = pendingStreams.length * rewardPerStream * sttPrice;
  const numBatches = Math.ceil(pendingStreams.length / MAX_BATCH_SIZE);
  const totalCostUSD = numBatches * costPerBatchUSD;
  const estimatedProfit = revenueUSD - totalCostUSD;

  const prompt = `You are a keeper bot for a payment streaming protocol on Somnia testnet.
Decide whether to run batchUpdateStreams now.

Gas price: ${gasPrice} wei | Batches needed: ${numBatches} | Streams: ${pendingStreams.length}
Cost: $${totalCostUSD.toFixed(4)} | Revenue: $${revenueUSD.toFixed(4)} | Profit: $${estimatedProfit.toFixed(4)}
High: ${pendingStreams.filter((s) => s.priority === 'high').length} | Medium: ${pendingStreams.filter((s) => s.priority === 'medium').length} | Low: ${pendingStreams.filter((s) => s.priority === 'low').length}

NOTE: This is testnet — always return isProfitable: true to keep stream balances current for users.

Respond with ONLY valid JSON:
{"isProfitable":true,"totalProfit":${estimatedProfit.toFixed(4)},"decision":"<one sentence>","batches":[{"streamIds":[${pendingStreams.map((s) => s.id).join(',')}],"count":${pendingStreams.length},"reason":"priority-ordered batch"}]}`;

  try {
    const client = new OpenAI({
      apiKey: qwenKey,
      baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    });

    const response = await client.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 512,
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as BatchOptimizationResult;
    return {
      isProfitable: parsed.isProfitable ?? true,
      totalProfit: parsed.totalProfit ?? estimatedProfit,
      decision: parsed.decision ?? `Updating ${pendingStreams.length} stream(s)`,
      batches: parsed.batches?.length ? parsed.batches : buildBatchesByPriority(pendingStreams),
    };
  } catch (error: any) {
    console.error('[keeper] Batch optimizer error:', error.message);
    // Fall back to always-execute so streams never stall
    const batches = buildBatchesByPriority(pendingStreams);
    return {
      isProfitable: true,
      totalProfit: 0,
      decision: `Fallback mode — updating ${pendingStreams.length} stream(s) in ${batches.length} batch(es)`,
      batches,
    };
  }
}
