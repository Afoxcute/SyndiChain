  import { HardhatUserConfig } from "hardhat/config";
  import "@nomicfoundation/hardhat-toolbox-viem";
  import "hardhat-gas-reporter"; // Add this import
  import "dotenv/config";
  import "@nomicfoundation/hardhat-verify";


  const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const SOMNIA_TESTNET_RPC_URL = process.env.SOMNIA_TESTNET_RPC_URL || "https://dream-rpc.somnia.network";
  const SOMNIA_MAINNET_RPC_URL = process.env.SOMNIA_MAINNET_RPC_URL || "https://api.infra.mainnet.somnia.network";

  const config: HardhatUserConfig = {
    solidity: {
      version: "0.8.24",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true,
      },
    },

    networks: {
      hardhat: {
        chainId: 31337,
      },
      somniaTestnet: {
        url: SOMNIA_TESTNET_RPC_URL,
        accounts: [PRIVATE_KEY],
        chainId: 50312,
        gasPrice: 20000000000,
      },
      somniaMainnet: {
        url: SOMNIA_MAINNET_RPC_URL,
        accounts: [PRIVATE_KEY],
        chainId: 5031,
        gasPrice: 20000000000,
      },
    },
    
    gasReporter: {
      enabled: process.env.REPORT_GAS !== undefined,
      currency: "USD",
      outputFile: "gas-report.txt",
      noColors: true,
    },

    etherscan: {
      apiKey: {
        somniaTestnet: "empty",
        somniaMainnet: "empty", 
      },
      customChains: [
        {
          network: "somniaTestnet",
          chainId: 50312,
          urls: {
            apiURL: "https://shannon-explorer.somnia.network/api",
            browserURL: "https://shannon-explorer.somnia.network",
          },
        },
        {
          network: "somniaMainnet",
          chainId: 5031,
          urls: {
            apiURL: "https://explorer.somnia.network/api",
            browserURL: "https://explorer.somnia.network",
          },
        },
      ],
    },

    paths: {
      sources: "./contracts",
      tests: "./test", 
      cache: "./cache",
      artifacts: "./artifacts",
    },
  };

  export default config;
