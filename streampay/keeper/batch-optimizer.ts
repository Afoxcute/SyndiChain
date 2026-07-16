import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Stream {
  id: number;
  priority: "high" | "medium" | "low";
  reward: number; // STT
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

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * AI-powered batch optimization
 * Runs once per 10-second cycle
 * Uses Gemini to decide if updating is profitable
 */
export async function optimizeBatching(
  pendingStreams: Stream[],
  gasPrice: bigint,
  rewardPerStream: number,
  ethPrice: number = 2000,
  stmPrice: number = 20
): Promise<BatchOptimizationResult> {
  const baseGasPerBatch = 50000;
  const costPerBatchUSD = (Number(gasPrice) * baseGasPerBatch * ethPrice) / 1e18;

  const prompt = `
You are a Keeper Bot Decision Engine for a payment streaming protocol on Somnia blockchain.
Your job is to decide whether to execute batch updates right now based on profitability.

MARKET CONDITIONS:
- Current Gas Price: ${gasPrice} wei
- ETH Price: $${ethPrice}
- STM Price: $${stmPrice}
- Cost per batch update (50000 gas): $${costPerBatchUSD.toFixed(4)}
- Reward per stream updated: ${rewardPerStream} STM (~$${(rewardPerStream * stmPrice).toFixed(4)})

CONSTRAINTS:
- Max batch size: 200 streams per transaction
- Total pending streams to update: ${pendingStreams.length}

PENDING STREAMS (summary):
- High priority: ${pendingStreams.filter((s) => s.priority === "high").length} streams
- Medium priority: ${pendingStreams.filter((s) => s.priority === "medium").length} streams
- Low priority: ${pendingStreams.filter((s) => s.priority === "low").length} streams

PROFITABILITY CALCULATION:
- Total potential revenue: ${pendingStreams.length} × $${(rewardPerStream * stmPrice).toFixed(4)} = $${(pendingStreams.length * rewardPerStream * stmPrice).toFixed(2)}
- Number of batches needed: ${Math.ceil(pendingStreams.length / 200)}
- Total gas cost: ${Math.ceil(pendingStreams.length / 200)} × $${costPerBatchUSD.toFixed(4)} = $${(Math.ceil(pendingStreams.length / 200) * costPerBatchUSD).toFixed(2)}
- Estimated profit: $${(pendingStreams.length * rewardPerStream * stmPrice - Math.ceil(pendingStreams.length / 200) * costPerBatchUSD).toFixed(2)}

YOUR DECISION:
Analyze the numbers above and decide:
1. Is it profitable to execute batch updates right now?
2. If yes, how should we batch the streams? (High priority first, then medium, then low)
3. What is the expected profit?

Respond ONLY with this JSON (no markdown):
{
  "isProfitable": true/false,
  "totalProfit": 0.15,
  "decision": "Executing 2 batches. Gas is low and profit margin is good.",
  "batches": [
    {
      "streamIds": [1, 5, 10, 25, ...],
      "count": 100,
      "reason": "High-priority streams"
    },
    {
      "streamIds": [2, 3, 4, 6, ...],
      "count": 100,
      "reason": "Medium-priority streams"
    }
  ]
}

Keep the JSON compact and valid.
`;

  try {
    const model = gemini.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse batch optimizer response:", responseText);
      return {
        isProfitable: false,
        totalProfit: 0,
        decision: "AI response parsing failed",
        batches: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as BatchOptimizationResult;

    return {
      isProfitable: parsed.isProfitable || false,
      totalProfit: parsed.totalProfit || 0,
      decision: parsed.decision || "Unable to decide",
      batches: parsed.batches || [],
    };
  } catch (error) {
    console.error("Batch optimization error:", error);
    return {
      isProfitable: false,
      totalProfit: 0,
      decision: "Optimization error, skipping this cycle",
      batches: [],
    };
  }
}