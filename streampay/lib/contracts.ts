// Contract addresses and configuration
// This will be populated by the deploy script

export const CONTRACT_ADDRESSES = {
  STREAM_PAY: process.env.NEXT_PUBLIC_STREAM_PAY_ADDRESS as `0x${string}`,
  STREAM_KEEPER: process.env.NEXT_PUBLIC_STREAM_KEEPER_ADDRESS as `0x${string}`,
  STREAM_FACTORY: process.env.NEXT_PUBLIC_STREAM_FACTORY_ADDRESS as `0x${string}`,
} as const;

export const NETWORK_CONFIG = {
  CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "50312"),
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network",
  BLOCK_EXPLORER: process.env.NEXT_PUBLIC_BLOCK_EXPLORER || "https://shannon-explorer.somnia.network",
  NATIVE_CURRENCY: "STT",
} as const;

// Somnia Testnet Chain Configuration
export const somniaTestnet = {
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
  testnet: true,
} as const;

// Rate conversion helpers
export const RATE_HELPERS = {
  // Convert USD per hour to wei per second (assuming 1 STT = $2000)
  usdHourToWeiSecond: (usdPerHour: number): bigint => {
    const sttPerHour = usdPerHour / 2000; // Assuming $2000 per STT
    const weiPerHour = BigInt(Math.floor(sttPerHour * 1e18));
    return weiPerHour / 3600n; // Convert to per second - FIXED: Added 'n' suffix
  },
  
  // Convert wei per second to USD per hour
  weiSecondToUsdHour: (weiPerSecond: bigint): number => {
    const weiPerHour = weiPerSecond * 3600n; // FIXED: Added 'n' suffix
    const sttPerHour = Number(weiPerHour) / 1e18;
    return sttPerHour * 2000; // Assuming $2000 per STT
  },
  
  // Format wei to display amount
  formatWei: (wei: bigint): string => {
    return (Number(wei) / 1e18).toFixed(6);
  },
  
  // Parse display amount to wei
  parseToWei: (amount: string): bigint => {
    return BigInt(Math.floor(parseFloat(amount) * 1e18));
  }
} as const;

// Stream type configurations
export const STREAM_TYPES = {
  work: {
    name: "Work",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: "💼",
    description: "Hourly work payments"
  },
  subscription: {
    name: "Subscription", 
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: "📱",
    description: "Recurring subscriptions"
  },
  gaming: {
    name: "Gaming",
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500/10",
    icon: "🎮",
    description: "Gaming rewards"
  }
} as const;

export type StreamType = keyof typeof STREAM_TYPES;
