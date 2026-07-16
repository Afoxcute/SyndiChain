#!/usr/bin/env node

const { createWalletClient, createPublicClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

// ✅ ADD VALIDATION
let STREAM_PAY_ADDRESS = process.env.STREAM_PAY_ADDRESS;

if (!STREAM_PAY_ADDRESS) {
  console.error("❌ STREAM_PAY_ADDRESS not set!");
  console.error("Usage: STREAM_PAY_ADDRESS=0x... KEEPER_PRIVATE_KEY=0x... node keeper-bot-somnia-testnet.js");
  process.exit(1);
}

// Ensure it's lowercase with 0x prefix
if (!STREAM_PAY_ADDRESS.startsWith("0x")) {
  STREAM_PAY_ADDRESS = "0x" + STREAM_PAY_ADDRESS;
}
STREAM_PAY_ADDRESS = STREAM_PAY_ADDRESS.toLowerCase();

console.log("✅ StreamPay:", STREAM_PAY_ADDRESS);
console.log("✅ Address length:", STREAM_PAY_ADDRESS.length, "(should be 42)");

const CHAIN_CONFIG = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
};

const RPC_URL = "https://dream-rpc.somnia.network";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ KEEPER_PRIVATE_KEY not set!");
  process.exit(1);
}

const STREAM_PAY_ABI = [
  {
    name: "getActiveStreamIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "batchUpdateStreams",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamIds", type: "uint256[]" }],
    outputs: [],
  },
];

async function runKeeper() {
  const account = privateKeyToAccount(PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: CHAIN_CONFIG,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: CHAIN_CONFIG,
    transport: http(RPC_URL),
  });

  console.log("🤖 Keeper bot started");
  console.log("- StreamPay:", STREAM_PAY_ADDRESS);
  console.log("- Keeper wallet:", account.address);
  console.log("- Network: Somnia Testnet\n");

  setInterval(async () => {
    try {
      const streamIds = await publicClient.readContract({
        address: STREAM_PAY_ADDRESS,
        abi: STREAM_PAY_ABI,
        functionName: "getActiveStreamIds",
      });

      if (streamIds.length === 0) {
        console.log("💤 No active streams");
        return;
      }

      console.log(`⏰ Upkeep... (${streamIds.length} streams)`);

      const hash = await walletClient.writeContract({
        address: STREAM_PAY_ADDRESS,
        abi: STREAM_PAY_ABI,
        functionName: "batchUpdateStreams",
        args: [streamIds],
      });

      console.log("✅ Tx:", hash);
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
  }, 5000);
}

runKeeper().catch(console.error);
