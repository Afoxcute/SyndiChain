import 'dotenv/config';
import { 
  createWalletClient, 
  createPublicClient, 
  http, 
  formatGwei,
  parseEther, 
  formatEther
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../lib/contracts"; 
import { STREAM_PAY_ABI } from "../lib/abis/StreamPay"; 
import { optimizeBatching, Stream } from "./batch-optimizer";
// import { saveKeeperLog, initializeDatabase } from "../lib/db";

// 1. LOAD ENV VARS
const STREAM_PAY_ADDRESS = process.env.STREAM_PAY_ADDRESS as `0x${string}`;
const SOMNIA_RPC_URL = process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network";
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY as `0x${string}`;

if (!STREAM_PAY_ADDRESS || !KEEPER_PRIVATE_KEY) {
  throw new Error("Missing STREAM_PAY_ADDRESS or KEEPER_PRIVATE_KEY in .env file");
}

// 2. SETUP VIEM CLIENTS
const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(SOMNIA_RPC_URL)
});

const walletClient = createWalletClient({
  account,
  chain: somniaTestnet,
  transport: http(SOMNIA_RPC_URL)
});

console.log("🤖 Intelligent Keeper Agent Started");
console.log(`🤖 Keeper wallet: ${account.address}`);
console.log(`📡 Connected to: ${SOMNIA_RPC_URL}`);
console.log(`🎯 Watching contract: ${STREAM_PAY_ADDRESS}`);

/**
 * Main intelligent keeper bot
 */
async function runIntelligentKeeper() {
  // Initialize database schema on start
  // await initializeDatabase();

  // Main loop
  setInterval(async () => {
    try {
      // 1. GET ACTIVE STREAMS
      const activeStreamIds = await publicClient.readContract({
        address: STREAM_PAY_ADDRESS,
        abi: STREAM_PAY_ABI,
        functionName: "getActiveStreamIds",
      }) as bigint[];

      if (activeStreamIds.length === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] ⏳ No streams to update.`);
        return;
      }
      
      console.log(`[${new Date().toLocaleTimeString()}] 📊 Analyzing ${activeStreamIds.length} streams...`);

      // 2. PREPARE DATA FOR AI
      const pendingStreams: Stream[] = activeStreamIds.map((id, index) => ({
        id: Number(id),
        priority: index % 3 === 0 ? "high" : index % 3 === 1 ? "medium" : "low",
        reward: 0.001, // 0.1%
        flowRate: 0n, // Placeholder
      }));

      // 3. GET GAS PRICE
      const gasPrice = await publicClient.getGasPrice();
      console.log(`⛽ Gas Price: ${formatGwei(gasPrice)} Gwei`);

      // 4. AI: DECIDE IF PROFITABLE
      const optimization = await optimizeBatching(
        pendingStreams,
        gasPrice,
        0.001, // reward per stream
        2000,  // ETH price (placeholder)
        20     // STM price (placeholder)
      );

      if (!optimization.isProfitable) {
        console.log(`❌ Not profitable: ${optimization.decision}`);
        // await saveKeeperLog({
        //   decision: "SKIP",
        //   reason: optimization.decision,
        //   gasPrice: gasPrice.toString(),
        //   timestamp: new Date(),
        // });
        return;
      }

      console.log(`✅ PROFITABLE: ${optimization.decision}`);
      console.log(`💰 Expected profit: $${optimization.totalProfit.toFixed(4)}`);

      // 5. EXECUTE BATCHES
      for (const batch of optimization.batches) {
        try {
          console.log(`  → Updating batch of ${batch.count} streams...`);
          
          // Use viem's writeContract
          const hash = await walletClient.writeContract({
            account,
            address: STREAM_PAY_ADDRESS,
            abi: STREAM_PAY_ABI,
            functionName: 'batchUpdateStreams',
            args: [batch.streamIds.map(id => BigInt(id))] // Ensure args are bigints
          });

          console.log(`  📤 Tx sent: ${hash}`);
          
          // Wait for confirmation
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);

          // await saveKeeperLog({
          //   decision: "EXECUTE",
          //   batchSize: batch.count,
          //   streamIds: batch.streamIds.join(","),
          //   expectedProfit: optimization.totalProfit / optimization.batches.length,
          //   txHash: hash,
          //   timestamp: new Date(),
          // });
        } catch (batchError: any) {
          console.error(`  ❌ Batch failed:`, batchError.message);
        }
      }
    } catch (error: any) {
      console.error("❌ Keeper cycle error:", error.message);
    }
  }, 10000); // Every 10 seconds
}

// Start keeper
runIntelligentKeeper().catch(console.error);