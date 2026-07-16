// Auto-generated contract configuration
// Generated at: 2025-11-05T21:44:06.356Z
// Network: Somnia Testnet

export const CONTRACT_ADDRESSES = {
  STREAM_PAY: "0xeff8b331a37cb2c03c04a087c53695a2b6dc0d45",
  STREAM_KEEPER: "0x251c6cff222eed46017731b4c87afd7af08f0c60",
  STREAM_FACTORY: "0xd91324c4c700bea8748ec11d8c510d8b32d2ca00",
} as const;

export const DEPLOYMENT_INFO = {
  BLOCK: 221116650n,
  NETWORK: "Somnia Testnet",
  TIMESTAMP: 1762379046,
  DEPLOYER: "0xd701436ccB7ae9223d270783e54C2463DB7fb004",
  CURRENCY: "STT",
} as const;

// Network-specific configurations
export const NETWORK_CONFIG = {
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545",
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || 31337,
  BLOCK_EXPLORER: process.env.NEXT_PUBLIC_BLOCK_EXPLORER || "http://localhost:8545",
  NATIVE_CURRENCY: "STT",
} as const;

// Rate conversion helpers  
export const RATE_HELPERS = {
  // Convert USD per hour to wei per second (assuming 1 STT = $2000)
  usdHourToWeiSecond: (usdPerHour: number): bigint => {
    const ethPerHour = usdPerHour / 2000; // Assuming $2000 per STT
    const weiPerHour = parseEther(ethPerHour.toString());
    return weiPerHour / 3600n; // Convert to per second
  },
  
  // Convert wei per second to USD per hour
  weiSecondToUsdHour: (weiPerSecond: bigint): number => {
    const weiPerHour = weiPerSecond * 3600n;
    const ethPerHour = Number(formatEther(weiPerHour));
    return ethPerHour * 2000; // Assuming $2000 per STT
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
