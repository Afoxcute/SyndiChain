/**
 * On-chain transaction submission using KEEPER_PRIVATE_KEY + viem.
 * Called after human approval to broadcast the encoded multicall to Somnia.
 */

import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { FormattedTransaction } from './types';

const SOMNIA_RPC = 'https://dream-rpc.somnia.network';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: [SOMNIA_RPC] } },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
});

export interface SubmitResult {
  txHash: string;
  explorerUrl: string;
}

/** Fetch gas price directly via JSON-RPC — works even if viem chain config lacks EIP-1559 */
async function fetchGasPrice(): Promise<{ maxFeePerGas?: bigint; gasPrice?: bigint }> {
  try {
    // Try eth_feeHistory to get baseFee (EIP-1559)
    const res = await fetch(SOMNIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', [50]],
      }),
    });
    const json = await res.json();
    const baseFeeHex = json?.result?.baseFeePerGas?.[0];
    if (baseFeeHex) {
      const baseFee = BigInt(baseFeeHex);
      // maxFeePerGas = baseFee × 2 (safe for next block), tip = 10% of baseFee
      return {
        maxFeePerGas: baseFee * 2n,
        // keep undefined for maxPriorityFeePerGas — viem will set it to 0
      };
    }
  } catch { /* fall through */ }

  // Fallback: eth_gasPrice (legacy)
  try {
    const res = await fetch(SOMNIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }),
    });
    const json = await res.json();
    if (json?.result) {
      const gp = BigInt(json.result);
      return { gasPrice: gp * 2n }; // 2× buffer
    }
  } catch { /* fall through */ }

  // Last resort: 50 gwei — high enough to clear most testnet base fees
  return { gasPrice: 50_000_000_000n };
}

export async function submitToSomnia(tx: FormattedTransaction): Promise<SubmitResult> {
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) throw new Error('KEEPER_PRIVATE_KEY not set in environment');

  const key = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(key);

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(SOMNIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(SOMNIA_RPC),
  });

  const [gasPricing, nonce] = await Promise.all([
    fetchGasPrice(),
    publicClient.getTransactionCount({ address: account.address }),
  ]);

  // Gas limit — provided estimate + 30% buffer
  const gasLimit = BigInt(Math.ceil(Number(tx.gasEstimate) * 1.3));

  const txHash = await walletClient.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value),
    gas: gasLimit,
    nonce,
    ...gasPricing,
  });

  return {
    txHash,
    explorerUrl: `https://shannon-explorer.somnia.network/tx/${txHash}`,
  };
}
