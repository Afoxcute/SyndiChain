import { NextRequest, NextResponse } from 'next/server';
import { createSwarmSession, getSession, getAllSessions, recordHumanDecision } from '@/lib/agents/swarm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'human_decision') {
      const { sessionId, decision } = body;
      const ok = await recordHumanDecision(sessionId, decision);
      if (!ok) return NextResponse.json({ error: 'Session not found or not awaiting decision' }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    const { prompt } = body;
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const sessionId = await createSwarmSession(prompt);
    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error('Swarm API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (sessionId) {
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json(session);
  }

  return NextResponse.json(await getAllSessions());
}
