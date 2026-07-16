import { sql } from "@vercel/postgres";

/**
 * Keeper Bot Database Operations
 * Uses Vercel Postgres for persistent logging and stream tracking
 */

export interface KeeperLog {
  id?: string;
  decision: "EXECUTE" | "SKIP";
  batchSize?: number;
  streamIds?: string;
  expectedProfit?: number;
  txHash?: string;
  reason?: string;
  gasPrice?: string;
  timestamp: Date;
}

/**
 * Initialize database schema (run once)
 */
export async function initializeDatabase() {
  try {
    // Create keeper_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS keeper_logs (
        id SERIAL PRIMARY KEY,
        decision VARCHAR(50) NOT NULL,
        batch_size INTEGER,
        stream_ids TEXT,
        expected_profit DECIMAL(20, 8),
        tx_hash VARCHAR(255),
        reason TEXT,
        gas_price VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create stream_fraud_checks table
    await sql`
      CREATE TABLE IF NOT EXISTS stream_fraud_checks (
        id SERIAL PRIMARY KEY,
        stream_id VARCHAR(255) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        risk_score INTEGER,
        risk_factors TEXT,
        recommendation VARCHAR(50),
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create index for fast queries
    await sql`
      CREATE INDEX IF NOT EXISTS keeper_logs_timestamp_idx 
      ON keeper_logs(timestamp DESC);
    `;

    console.log("✅ Database schema initialized");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

/**
 * Save keeper decision to database
 */
export async function saveKeeperLog(log: KeeperLog): Promise<void> {
  try {
    await sql`
      INSERT INTO keeper_logs (
        decision,
        batch_size,
        stream_ids,
        expected_profit,
        tx_hash,
        reason,
        gas_price,
        timestamp
      ) VALUES (
        ${log.decision},
        ${log.batchSize || null},
        ${log.streamIds || null},
        ${log.expectedProfit || null},
        ${log.txHash || null},
        ${log.reason || null},
        ${log.gasPrice || null},
        ${log.timestamp.toISOString()}
      )
    `;
  } catch (error) {
    console.error("Failed to save keeper log:", error);
  }
}

/**
 * Get recent keeper decisions (for dashboard)
 */
export async function getRecentKeeperLogs(limit: number = 20) {
  try {
    const result = await sql`
      SELECT * FROM keeper_logs
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    console.error("Failed to fetch keeper logs:", error);
    return [];
  }
}

/**
 * Save fraud check result
 */
export async function saveFraudCheckResult(
  streamId: string,
  recipient: string,
  riskScore: number,
  riskFactors: string[],
  recommendation: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO stream_fraud_checks (
        stream_id,
        recipient,
        risk_score,
        risk_factors,
        recommendation
      ) VALUES (
        ${streamId},
        ${recipient},
        ${riskScore},
        ${JSON.stringify(riskFactors)},
        ${recommendation}
      )
    `;
  } catch (error) {
    console.error("Failed to save fraud check:", error);
  }
}

/**
 * Get fraud check history for a recipient
 */
export async function getRecipientFraudHistory(recipient: string) {
  try {
    const result = await sql`
      SELECT * FROM stream_fraud_checks
      WHERE recipient = ${recipient}
      ORDER BY checked_at DESC
      LIMIT 10
    `;
    return result.rows;
  } catch (error) {
    console.error("Failed to fetch fraud history:", error);
    return [];
  }
}

/**
 * Get keeper profitability stats
 */
export async function getKeeperStats() {
  try {
    const result = await sql`
      SELECT
        COUNT(CASE WHEN decision = 'EXECUTE' THEN 1 END) as total_executions,
        SUM(CASE WHEN decision = 'EXECUTE' THEN expected_profit ELSE 0 END) as total_profit,
        AVG(CASE WHEN decision = 'EXECUTE' THEN expected_profit ELSE 0 END) as avg_profit,
        COUNT(CASE WHEN decision = 'SKIP' THEN 1 END) as skipped,
        MAX(timestamp) as last_update
      FROM keeper_logs
    `;
    return result.rows[0] || {};
  } catch (error) {
    console.error("Failed to fetch keeper stats:", error);
    return {};
  }
}
