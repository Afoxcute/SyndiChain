/**
 * Thin on-chain readers for TreasuryPolicy.sol and SomniaAgentRiskOracle.sol.
 * Uses raw eth_call via the Somnia public RPC — no SDK dependency.
 * Falls back silently when contract addresses aren't configured.
 */

const SOMNIA_RPC = 'https://dream-rpc.somnia.network';

// ─── ABI-encoded eth_call helper ─────────────────────────────────────────────

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(SOMNIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

function decodeUint256(hex: string, offset = 0): bigint {
  const slice = hex.slice(2 + offset * 64, 2 + (offset + 1) * 64);
  return slice ? BigInt('0x' + slice) : 0n;
}

// ─── TreasuryPolicy.sol reader ────────────────────────────────────────────────

export interface OnChainPolicy {
  dailyTransferLimit: number;  // STT (human units)
  singleTxLimit: number;
  minLiquidityReserve: number;
  multisigThreshold: number;
}

/**
 * Read getPolicy() from deployed TreasuryPolicy.sol.
 * Returns null when NEXT_PUBLIC_TREASURY_POLICY_ADDRESS is unset or call fails.
 */
export async function readTreasuryPolicy(): Promise<OnChainPolicy | null> {
  const addr = process.env.NEXT_PUBLIC_TREASURY_POLICY_ADDRESS;
  if (!addr || addr === '') return null;

  // getPolicy() → selector = keccak256("getPolicy()")[:4] = 0x24b7b933
  const result = await ethCall(addr, '0x24b7b933');
  if (!result || result === '0x') return null;

  try {
    // Policy struct ABI encoding (5 uint256 fields):
    // dailyTransferLimit, singleTxLimit, minLiquidityReserve, requiresMultisig, multisigThreshold
    const wei = (n: bigint) => Number(n / BigInt(1e18));
    return {
      dailyTransferLimit: wei(decodeUint256(result, 0)),
      singleTxLimit:      wei(decodeUint256(result, 1)),
      minLiquidityReserve: wei(decodeUint256(result, 2)),
      // slot 3 is requiresMultisig (bool, packed as uint256)
      multisigThreshold:  wei(decodeUint256(result, 4)),
    };
  } catch {
    return null;
  }
}

// ─── SomniaAgentRiskOracle.sol reader ────────────────────────────────────────

export interface OnChainRiskScore {
  score: number;   // 0-100
  tier: string;    // 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'UNKNOWN'
}

/**
 * Call getCompositeRiskScore(address) on SomniaAgentRiskOracle.sol.
 * Returns null when oracle address is unset or call fails.
 */
export async function readOnChainRiskScore(protocolAddress: string): Promise<OnChainRiskScore | null> {
  const oracleAddr = process.env.NEXT_PUBLIC_RISK_ORACLE_ADDRESS;
  if (!oracleAddr || oracleAddr === '') return null;

  // getCompositeRiskScore(address) → keccak256("getCompositeRiskScore(address)")[:4] = 0x8d8f0c1f
  const paddedAddr = protocolAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const result = await ethCall(oracleAddr, `0x8d8f0c1f${paddedAddr}`);
  if (!result || result === '0x') return null;

  try {
    // Returns (uint8 score, string tier)
    // score is in first slot (uint8 packed in uint256), string in subsequent slots
    const score = Number(decodeUint256(result, 0));

    // Decode the tier string from ABI-encoded string at offset slot 1
    const strOffset = Number(decodeUint256(result, 1));  // byte offset into calldata
    const strLen = Number(decodeUint256(result, strOffset / 32));
    const strHex = result.slice(2 + (strOffset / 32 + 1) * 64, 2 + (strOffset / 32 + 1) * 64 + strLen * 2);
    const tier = Buffer.from(strHex, 'hex').toString('utf8');

    return { score: Math.min(score, 100), tier: tier || (score >= 70 ? 'HIGH_RISK' : score >= 40 ? 'CAUTION' : 'SAFE') };
  } catch {
    return null;
  }
}
