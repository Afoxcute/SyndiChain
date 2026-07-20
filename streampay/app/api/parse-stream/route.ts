import { NextResponse } from 'next/server';
import { callLLM, extractJSON } from '@/lib/agents/llm';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text input is required' }, { status: 400 });
    }

    const system = `You are a blockchain payment stream parser. Extract transaction details from natural language and respond with valid JSON only — no markdown, no explanation.`;

    const prompt = `Parse this payment stream description and return JSON with exactly these fields:
- recipient: valid Ethereum address (0x + 40 hex chars). If missing use "0x0000000000000000000000000000000000000000"
- amount: numeric string in STT (e.g. "1.5")
- duration: numeric value
- durationUnit: one of "seconds" | "minutes" | "hours" | "days"
- streamType: one of "work" | "subscription" | "gaming"
- description: brief purpose (max 50 chars)

Input: "${text}"

Respond with JSON only.`;

    const raw = await callLLM(system, prompt, 'fast');
    const parsed = JSON.parse(extractJSON(raw));

    if (!parsed?.recipient || !parsed?.amount || !parsed?.duration || !parsed?.durationUnit) {
      return NextResponse.json({ error: 'Failed to extract required fields from input' }, { status: 400 });
    }

    if (!parsed.recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format detected' }, { status: 400 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Parse stream error:', error);
    return NextResponse.json({ error: 'Failed to parse stream details. Please try manual entry.' }, { status: 500 });
  }
}
