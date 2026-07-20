import { NextResponse } from 'next/server';

const SYSTEM = `You are a payment stream parser. You must respond with a single JSON object and nothing else.`;

async function parseWithQwen(text: string): Promise<any> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error('No QWEN_API_KEY');

  const res = await fetch(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'qwen-turbo',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Extract payment stream details from: "${text}"

Return ONLY this JSON object:
{
  "recipient": "0x address (or 0x0000000000000000000000000000000000000000 if none found)",
  "amount": "number as string e.g. 1.5",
  "duration": 24,
  "durationUnit": "hours",
  "streamType": "work",
  "description": "brief purpose"
}

durationUnit must be one of: seconds, minutes, hours, days
streamType must be one of: work, subscription, gaming`,
          },
        ],
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) throw new Error(`Qwen error ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content as string;
  return JSON.parse(content);
}

async function parseWithClaude(text: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Extract payment stream details from: "${text}"
Return ONLY a JSON object with: recipient, amount (string), duration (number), durationUnit (seconds|minutes|hours|days), streamType (work|subscription|gaming), description`,
      }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Claude error ${res.status}`);
  const data = await res.json();
  const content = data.content[0].text as string;
  // Strip any markdown fences
  const match = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
}

function normalise(raw: any) {
  // Accept common field name variations from LLMs
  return {
    recipient: raw.recipient ?? raw.address ?? raw.to ?? raw.wallet ?? '0x0000000000000000000000000000000000000000',
    amount: String(raw.amount ?? raw.value ?? raw.total ?? raw.stt ?? '0.1'),
    duration: Number(raw.duration ?? raw.time ?? raw.period ?? 24),
    durationUnit: raw.durationUnit ?? raw.unit ?? raw.timeUnit ?? 'hours',
    streamType: raw.streamType ?? raw.type ?? raw.category ?? 'work',
    description: raw.description ?? raw.purpose ?? raw.note ?? '',
  };
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text input is required' }, { status: 400 });
    }

    let raw: any;
    try {
      raw = await parseWithQwen(text);
    } catch (qwenErr) {
      console.warn('Qwen parse failed, trying Claude:', qwenErr);
      try {
        raw = await parseWithClaude(text);
      } catch (claudeErr) {
        console.error('Both LLMs failed:', claudeErr);
        return NextResponse.json({ error: 'AI parsing unavailable. Please fill the form manually.' }, { status: 503 });
      }
    }

    const parsed = normalise(raw);

    if (!parsed.recipient || !parsed.amount || !parsed.duration || !parsed.durationUnit) {
      return NextResponse.json({ error: 'Could not extract all required fields. Try rephrasing.' }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(parsed.recipient)) {
      return NextResponse.json({ error: 'Invalid Ethereum address in description.' }, { status: 400 });
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Parse stream error:', error);
    return NextResponse.json({ error: 'Failed to parse stream details. Please fill manually.' }, { status: 500 });
  }
}
