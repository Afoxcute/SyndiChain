export type LLMMode = 'reasoning' | 'fast';

/**
 * Unified LLM client — prefers Qwen (per spec), falls back to Claude.
 * Manager uses 'reasoning' (Qwen-Max / Claude Sonnet).
 * Worker agents use 'fast'  (Qwen-Turbo / Claude Haiku).
 */
export async function callLLM(
  system: string,
  user: string,
  mode: LLMMode
): Promise<string> {
  const qwenKey = process.env.QWEN_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (qwenKey) return callQwen(system, user, mode, qwenKey);
  if (claudeKey) return callClaude(system, user, mode, claudeKey);
  throw new Error('No LLM API key. Set QWEN_API_KEY or ANTHROPIC_API_KEY in .env.local');
}

async function callQwen(
  system: string,
  user: string,
  mode: LLMMode,
  apiKey: string
): Promise<string> {
  const model = mode === 'reasoning' ? 'qwen-plus' : 'qwen-turbo';

  const response = await fetch(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Qwen ${model} failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices[0].message.content as string;
}

async function callClaude(
  system: string,
  user: string,
  mode: LLMMode,
  apiKey: string
): Promise<string> {
  const model =
    mode === 'reasoning' ? 'claude-sonnet-5' : 'claude-haiku-4-5-20251001';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude ${model} failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.content[0].text as string;
}

export function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in LLM response');
  return match[0];
}

/** Returns which provider is active, for display purposes */
export function activeLLMProvider(): 'qwen' | 'claude' | 'none' {
  if (process.env.QWEN_API_KEY) return 'qwen';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'none';
}
