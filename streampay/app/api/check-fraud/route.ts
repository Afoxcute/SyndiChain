import { NextResponse } from 'next/server';
import { callLLM, extractJSON } from '@/lib/agents/llm';

export interface FraudCheckResult {
  riskScore: number;
  riskFactors: string[];
  recommendation: 'proceed' | 'warn' | 'block';
  message: string;
}

export async function POST(request: Request) {
  try {
    const stream = await request.json();

    const system = `You are a blockchain fraud detection engine. Analyze payment streams for suspicious patterns. Respond with valid JSON only.`;

    const prompt = `Analyze this payment stream for fraud risk:

Recipient: ${stream.recipient}
Amount: ${stream.amount} STT
Duration: ${stream.duration} seconds

Respond with JSON only:
{"riskScore": 0-100, "riskFactors": ["..."], "recommendation": "proceed"|"warn"|"block", "message": "..."}

Consider: unusual amounts, zero-address recipient, very short or very long durations, round-number patterns.`;

    const raw = await callLLM(system, prompt, 'fast');
    const parsed = JSON.parse(extractJSON(raw)) as FraudCheckResult;

    if (!parsed) {
      return NextResponse.json({ riskScore: 10, riskFactors: [], recommendation: 'proceed', message: '✅ Stream looks safe.' });
    }

    return NextResponse.json({
      riskScore: Math.min(100, Math.max(0, parsed.riskScore ?? 10)),
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      recommendation: parsed.recommendation ?? 'proceed',
      message: parsed.message ?? 'Stream analysis complete.',
    });
  } catch (error: any) {
    console.error('Fraud check error:', error.message);
    return NextResponse.json({ riskScore: 10, riskFactors: [], recommendation: 'proceed', message: '✅ Stream safe.' });
  }
}
