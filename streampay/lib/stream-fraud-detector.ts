import toast from "react-hot-toast";

// Interface for stream data
export interface FraudCheckInput {
  recipient: string;
  amount: string;
  duration: number; // in seconds
  senderAddress: string; // User's wallet address
}

// Interface for the AI's response
export interface FraudCheckResult {
  riskScore: number;
  riskFactors: string[];
  recommendation: "proceed" | "warn" | "block";
  message: string;
}

/**
 * Calls the secure backend API to perform a fraud check.
 */
export async function detectCreationFraud(
  stream: FraudCheckInput
): Promise<FraudCheckResult> {
  try {
    const response = await fetch('/api/check-fraud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stream),
    });

    if (!response.ok) {
      throw new Error('Fraud check API failed');
    }

    return await response.json();
    
  } catch (error) {
    console.error("Fraud detection error:", error);
    toast.error("Fraud check failed. Please be cautious.");
    // Fallback: If API fails, be permissive but add a warning
    return {
      riskScore: 30,
      riskFactors: ["Detection service error"],
      recommendation: "proceed",
      message: "Fraud detection temporarily unavailable. Please double-check the details.",
    };
  }
}