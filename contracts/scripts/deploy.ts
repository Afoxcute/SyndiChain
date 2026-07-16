import { createWalletClient, createPublicClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, localhost } from "viem/chains";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import "dotenv/config"; 
// Define Somnia chains
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  network: "somnia-testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
    public: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
} as const;

const somniaMainnet = {
  id: 5031,
  name: "Somnia Mainnet",
  network: "somnia-mainnet",
  nativeCurrency: { name: "SOMI", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.infra.mainnet.somnia.network"] },
    public: { http: ["https://api.infra.mainnet.somnia.network"] },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://explorer.somnia.network",
    },
  },
} as const;

interface DeploymentData {
  streamPay: `0x${string}`;
  streamKeeper: `0x${string}`;
  streamFactory: `0x${string}`;
  deploymentBlock: string;
  network: string;
  timestamp: number;
  deployer: `0x${string}`;
}

interface ContractAddresses {
  [key: string]: DeploymentData;
}

async function main() {
  console.log("🚀 Starting SyndiChain deployment...\n");
  
  // Setup clients and account
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  
  const account = privateKeyToAccount(privateKey);
  
  // Determine which chain to use
  let chain;
  const networkName = process.env.NETWORK || "localhost";
  
  switch (networkName) {
    case "localhost":
      chain = localhost;
      break;
    case "somniaTestnet":
      chain = somniaTestnet;
      break;
    case "somniaMainnet":
      chain = somniaMainnet;
      break;
    default:
      chain = hardhat;
  }
  
  const publicClient = createPublicClient({
    chain,
    transport: http()
  });
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http()
  });
  
  const balance = await publicClient.getBalance({ address: account.address });
  
  console.log("Deployment details:");
  console.log("- Deployer:", account.address);
  console.log("- Network:", chain.name);
  console.log("- Chain ID:", chain.id.toString());
  console.log("- Balance:", formatEther(balance), chain.nativeCurrency.symbol, "\n");
  
  // Import contract artifacts
  const StreamPayArtifact = await import("../artifacts/contracts/StreamPay.sol/StreamPay.json");
  const StreamKeeperArtifact = await import("../artifacts/contracts/StreamKeeper.sol/StreamKeeper.json");
  const StreamFactoryArtifact = await import("../artifacts/contracts/StreamFactory.sol/StreamFactory.json");
  const TreasuryPolicyArtifact = await import("../artifacts/contracts/TreasuryPolicy.sol/TreasuryPolicy.json");
  const RiskOracleArtifact = await import("../artifacts/contracts/SomniaAgentRiskOracle.sol/SomniaAgentRiskOracle.json");
  
  // Deploy StreamPay main contract
  console.log("📋 Deploying StreamPay contract...");
  const streamPayHash = await walletClient.deployContract({
    abi: StreamPayArtifact.abi,
    bytecode: StreamPayArtifact.bytecode as `0x${string}`,
    args: [account.address],
  });
  
  const streamPayReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: streamPayHash 
  });
  const streamPayAddress = streamPayReceipt.contractAddress!;
  console.log("✅ StreamPay deployed at:", streamPayAddress);
  
  // Deploy StreamKeeper
  console.log("\n🔧 Deploying StreamKeeper contract...");
  const streamKeeperHash = await walletClient.deployContract({
    abi: StreamKeeperArtifact.abi,
    bytecode: StreamKeeperArtifact.bytecode as `0x${string}`,
    args: [streamPayAddress, account.address],
  });
  
  const streamKeeperReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: streamKeeperHash 
  });
  const streamKeeperAddress = streamKeeperReceipt.contractAddress!;
  console.log("✅ StreamKeeper deployed at:", streamKeeperAddress);
  
  // Deploy StreamFactory
  console.log("\n🏭 Deploying StreamFactory contract...");
  const streamFactoryHash = await walletClient.deployContract({
    abi: StreamFactoryArtifact.abi,
    bytecode: StreamFactoryArtifact.bytecode as `0x${string}`,
    args: [streamPayAddress, account.address],
  });
  
  const streamFactoryReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: streamFactoryHash 
  });
  const streamFactoryAddress = streamFactoryReceipt.contractAddress!;
  console.log("✅ StreamFactory deployed at:", streamFactoryAddress);
  
  // Deploy TreasuryPolicy (SyndiChain Compliance layer)
  console.log("\n📜 Deploying TreasuryPolicy contract...");
  const treasuryPolicyHash = await walletClient.deployContract({
    abi: TreasuryPolicyArtifact.abi,
    bytecode: TreasuryPolicyArtifact.bytecode as `0x${string}`,
    args: [account.address],
  });
  const treasuryPolicyReceipt = await publicClient.waitForTransactionReceipt({ hash: treasuryPolicyHash });
  const treasuryPolicyAddress = treasuryPolicyReceipt.contractAddress!;
  console.log("✅ TreasuryPolicy deployed at:", treasuryPolicyAddress);

  // Deploy SomniaAgentRiskOracle (Risk Agent data source)
  console.log("\n🔮 Deploying SomniaAgentRiskOracle contract...");
  const riskOracleHash = await walletClient.deployContract({
    abi: RiskOracleArtifact.abi,
    bytecode: RiskOracleArtifact.bytecode as `0x${string}`,
    args: [account.address],
  });
  const riskOracleReceipt = await publicClient.waitForTransactionReceipt({ hash: riskOracleHash });
  const riskOracleAddress = riskOracleReceipt.contractAddress!;
  console.log("✅ SomniaAgentRiskOracle deployed at:", riskOracleAddress);

  // Set keeper in main contract
  console.log("\n⚙️ Configuring contracts...");
  
  const setKeeperHash = await walletClient.writeContract({
    address: streamPayAddress,
    abi: StreamPayArtifact.abi,
    functionName: 'setKeeper',
    args: [streamKeeperAddress],
  });
  
  await publicClient.waitForTransactionReceipt({ hash: setKeeperHash });
  console.log("✅ Keeper set in StreamPay contract");

  // Get deployment block
  const deploymentBlock = await publicClient.getBlockNumber();
  
  // Prepare deployment data
  const deploymentData: DeploymentData = {
    streamPay: streamPayAddress,
    streamKeeper: streamKeeperAddress,
    streamFactory: streamFactoryAddress,
    deploymentBlock: deploymentBlock.toString(),
    network: chain.name,
    timestamp: Math.floor(Date.now() / 1000),
    deployer: account.address
  };
  
  // Save addresses to file
  const addressesDir = join(process.cwd(), "deployments");
  if (!existsSync(addressesDir)) {
    mkdirSync(addressesDir, { recursive: true });
  }
  
  // Load existing addresses or create new object
  const addressesPath = join(addressesDir, "addresses.json");
  let addresses: ContractAddresses = {};
  
  if (existsSync(addressesPath)) {
    addresses = JSON.parse(readFileSync(addressesPath, "utf8"));
  }
  
  // Update with new deployment
  const networkKey = `${chain.name}-${chain.id}`;
  addresses[networkKey] = deploymentData;
  
  // Save addresses file
  writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("📁 Contract addresses saved to:", addressesPath);
  
  // Generate frontend config
  await generateFrontendConfig(deploymentData, chain.name, chain.nativeCurrency.symbol);
  
  // Create demo streams for testing
  console.log("\n🎮 Creating demo streams...");
  await createDemoStreams(streamPayAddress, account.address, StreamPayArtifact.abi, walletClient, publicClient);
  
  // Start keeper bot if on testnet or localhost
  if (networkName === "somniaTestnet" || networkName === "localhost" || networkName === "hardhat") {
    console.log("\n🤖 Creating keeper bot script...");
    await createKeeperBot(streamKeeperAddress, chain, StreamKeeperArtifact.abi);
  }
  
  // Display final summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("Contract Addresses:");
  console.log("- StreamPay:", streamPayAddress);
  console.log("- StreamKeeper:", streamKeeperAddress);
  console.log("- StreamFactory:", streamFactoryAddress);
  console.log("- TreasuryPolicy:", treasuryPolicyAddress);
  console.log("- SomniaAgentRiskOracle:", riskOracleAddress);
  console.log("\nDeployment Block:", deploymentBlock.toString());
  console.log("Network:", chain.name);
  console.log("Chain ID:", chain.id);
  console.log("Native Currency:", chain.nativeCurrency.symbol);
  console.log("Block Explorer:", chain.blockExplorers?.default.url);
  console.log("\n📱 Frontend config generated at: frontend/utils/contracts.ts");
  console.log("🔗 Demo streams created for testing");
  
  if (networkName === "somniaTestnet") {
    console.log("\n💡 To get STT tokens for testing:");
    console.log("- Faucet: https://testnet.somnia.network/");
    console.log("- Explorer: https://shannon-explorer.somnia.network/");
  } else if (networkName === "somniaMainnet") {
    console.log("\n💡 Mainnet Resources:");
    console.log("- Explorer: https://explorer.somnia.network/");
    console.log("- Get SOMI tokens from supported exchanges");
  }
  
  console.log("\n🚀 Ready for demo!");
}

async function generateFrontendConfig(deployment: DeploymentData, networkName: string, currency: string) {
  const frontendDir = join(process.cwd(), "frontend", "utils");
  if (!existsSync(frontendDir)) {
    mkdirSync(frontendDir, { recursive: true });
  }
  
  const config = `// Auto-generated contract configuration
// Generated at: ${new Date().toISOString()}
// Network: ${networkName}

export const CONTRACT_ADDRESSES = {
  STREAM_PAY: "${deployment.streamPay}",
  STREAM_KEEPER: "${deployment.streamKeeper}",
  STREAM_FACTORY: "${deployment.streamFactory}",
} as const;

export const DEPLOYMENT_INFO = {
  BLOCK: ${deployment.deploymentBlock.toString()}n,
  NETWORK: "${deployment.network}",
  TIMESTAMP: ${deployment.timestamp},
  DEPLOYER: "${deployment.deployer}",
  CURRENCY: "${currency}",
} as const;

// Network-specific configurations
export const NETWORK_CONFIG = {
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545",
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || 31337,
  BLOCK_EXPLORER: process.env.NEXT_PUBLIC_BLOCK_EXPLORER || "http://localhost:8545",
  NATIVE_CURRENCY: "${currency}",
} as const;

// Rate conversion helpers  
export const RATE_HELPERS = {
  // Convert USD per hour to wei per second (assuming 1 ${currency} = $2000)
  usdHourToWeiSecond: (usdPerHour: number): bigint => {
    const ethPerHour = usdPerHour / 2000; // Assuming $2000 per ${currency}
    const weiPerHour = parseEther(ethPerHour.toString());
    return weiPerHour / 3600n; // Convert to per second
  },
  
  // Convert wei per second to USD per hour
  weiSecondToUsdHour: (weiPerSecond: bigint): number => {
    const weiPerHour = weiPerSecond * 3600n;
    const ethPerHour = Number(formatEther(weiPerHour));
    return ethPerHour * 2000; // Assuming $2000 per ${currency}
  },
  
  // Format wei to display amount
  formatWei: (wei: bigint): string => {
    return Number(formatEther(wei)).toFixed(6);
  },
  
  // Parse display amount to wei
  parseToWei: (amount: string): bigint => {
    return parseEther(amount);
  }
} as const;

// Demo stream configurations
export const DEMO_STREAMS = {
  WORK: {
    type: "work",
    rate: 25, // $25/hour
    duration: 3600, // 1 hour
    description: "Freelance development work"
  },
  SUBSCRIPTION: {
    type: "subscription", 
    rate: 10, // $10/month
    duration: 2592000, // 30 days
    description: "Premium content subscription"
  },
  GAMING: {
    type: "gaming",
    rate: 5, // $5/hour
    duration: 1800, // 30 minutes
    description: "Gaming rewards stream"
  }
} as const;

console.log("📋 StreamPay contracts loaded:");
console.log("- Network:", DEPLOYMENT_INFO.NETWORK);
console.log("- Currency:", DEPLOYMENT_INFO.CURRENCY);
console.log("- StreamPay:", CONTRACT_ADDRESSES.STREAM_PAY);
console.log("- StreamKeeper:", CONTRACT_ADDRESSES.STREAM_KEEPER);
console.log("- StreamFactory:", CONTRACT_ADDRESSES.STREAM_FACTORY);
`;
  
  const configPath = join(frontendDir, "contracts.ts");
  writeFileSync(configPath, config);
  console.log("📱 Frontend configuration generated");
}

async function createDemoStreams(
  streamPayAddress: `0x${string}`,
  deployerAddress: `0x${string}`,
  abi: any,
  walletClient: any,
  publicClient: any
) {
  try {
    // Demo stream configurations
    const demoConfigs = [
      {
        recipient: deployerAddress,
        duration: 3600, // 1 hour
        amount: parseEther("0.01"),
        type: "work",
        description: "Demo freelance work stream"
      },
      {
        recipient: deployerAddress,
        duration: 1800, // 30 minutes
        amount: parseEther("0.005"),
        type: "gaming",
        description: "Demo gaming rewards stream"
      },
      {
        recipient: deployerAddress,
        duration: 86400, // 1 day
        amount: parseEther("0.001"),
        type: "subscription",
        description: "Demo subscription stream"
      }
    ];
    
    for (let i = 0; i < demoConfigs.length; i++) {
      const config = demoConfigs[i];
      
      const hash = await walletClient.writeContract({
        address: streamPayAddress,
        abi: abi,
        functionName: 'createStream',
        args: [
          config.recipient,
          config.duration,
          config.type,
          config.description
        ],
        value: config.amount
      });
      
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Created demo ${config.type} stream (${i + 1}/${demoConfigs.length})`);
    }
    
    console.log("🎮 Demo streams created successfully");
  } catch (error) {
    console.warn("⚠️ Failed to create demo streams:", error);
  }
}

async function createKeeperBot(keeperAddress: `0x${string}`, chain: any, keeperAbi: any) {
  try {
    const keeperBotScript = `#!/usr/bin/env node
// Auto-generated keeper bot script for ${chain.name}
const { createWalletClient, createPublicClient, http, getContract } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const KEEPER_ADDRESS = "${keeperAddress}";
const CHAIN_CONFIG = ${JSON.stringify(chain, null, 2)};
const RPC_URL = "${chain.rpcUrls.default.http[0]}";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;

// Keeper ABI
const KEEPER_ABI = ${JSON.stringify(keeperAbi, null, 2)};

async function runKeeper() {
  if (!PRIVATE_KEY) {
    console.error("Please set KEEPER_PRIVATE_KEY environment variable");
    process.exit(1);
  }
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: CHAIN_CONFIG,
    transport: http(RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: CHAIN_CONFIG,
    transport: http(RPC_URL)
  });
  
  const keeper = getContract({
    address: KEEPER_ADDRESS,
    abi: KEEPER_ABI,
    client: { public: publicClient, wallet: walletClient }
  });
  
  console.log("🤖 Keeper bot started for ${chain.name}");
  console.log("- Keeper address:", KEEPER_ADDRESS);
  console.log("- Bot wallet:", account.address);
  console.log("- RPC URL:", RPC_URL);
  
  setInterval(async () => {
    try {
      const [upkeepNeeded] = await keeper.read.checkUpkeep(["0x"]);
      
      if (upkeepNeeded) {
        console.log("⏰ Performing upkeep...");
        const hash = await keeper.write.performUpkeep(["0x"], { 
          gas: 1000000n 
        });
        console.log("✅ Upkeep performed:", hash);
      } else {
        console.log("💤 No upkeep needed");
      }
    } catch (error) {
      console.error("❌ Keeper error:", error.message);
    }
  }, 5000); // Check every 5 seconds for real-time demo
}

runKeeper().catch(console.error);
`;
    
    const botDir = join(process.cwd(), "scripts");
    if (!existsSync(botDir)) {
      mkdirSync(botDir, { recursive: true });
    }
    
    const botPath = join(botDir, `keeper-bot-${chain.name.toLowerCase().replace(/\s+/g, '-')}.js`);
    writeFileSync(botPath, keeperBotScript);
    
    try {
      require("fs").chmodSync(botPath, "755");
    } catch (error) {
      // chmod might not work on Windows, ignore error
    }
    
    console.log("🤖 Keeper bot script created at:", botPath);
    console.log(`💡 To start: KEEPER_PRIVATE_KEY=your_key node "${botPath}"`);
    
  } catch (error) {
    console.warn("⚠️ Failed to create keeper bot:", error);
  }
}

// Handle deployment errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:");
    console.error(error);
    process.exit(1);
  });
