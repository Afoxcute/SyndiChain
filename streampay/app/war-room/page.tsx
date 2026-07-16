'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentMessage, SwarmSession } from '@/lib/agents/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain, ShieldAlert, TrendingUp, Cpu, Scale, Users,
  Send, CheckCircle, XCircle, AlertTriangle, Loader2,
  Zap, MessageSquare,
} from 'lucide-react';

const AGENT_CONFIG = {
  manager: { label: 'Manager', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', badge: 'bg-purple-500' },
  analyst: { label: 'Analyst', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-500' },
  risk: { label: 'Risk', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500' },
  execution: { label: 'Execution', icon: Cpu, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', badge: 'bg-green-500' },
  compliance: { label: 'Compliance', icon: Scale, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', badge: 'bg-yellow-500' },
} as const;

const EXAMPLE_PROMPTS = [
  'Diversify 50,000 STT into yield-bearing assets, keep 10,000 liquid for payroll next week, hedge against volatility',
  'Deploy 20,000 STT into the safest yield pools only — no unaudited contracts',
  'Maximize APY for 30,000 STT treasury across Somnia DEXes',
];

export default function WarRoomPage() {
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SwarmSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for session updates every 1.5 seconds while running
  useEffect(() => {
    if (!sessionId || !polling) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/swarm?sessionId=${sessionId}`);
      if (res.ok) {
        const data: SwarmSession = await res.json();
        setSession(data);
        if (data.status !== 'running' && data.status !== 'debating') {
          setPolling(false);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId, polling]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length]);

  async function startSwarm() {
    if (!prompt.trim()) return;
    setLoading(true);
    setSession(null);

    try {
      const res = await fetch('/api/swarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const { sessionId: id } = await res.json();
      setSessionId(id);
      setPolling(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleHumanDecision(decision: 'approved' | 'rejected') {
    if (!sessionId) return;
    await fetch('/api/swarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'human_decision', sessionId, decision }),
    });
    // Fetch once more to get final state
    const res = await fetch(`/api/swarm?sessionId=${sessionId}`);
    if (res.ok) setSession(await res.json());
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Zap className="h-8 w-8 text-purple-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            SyndiChain War Room
          </h1>
        </div>
        <p className="text-muted-foreground">
          Multi-Agent DAO Treasury Swarm — watch agents collaborate, debate, and propose safe transactions
        </p>
      </div>

      {/* Agent Status Bar */}
      <div className="grid grid-cols-5 gap-2">
        {(Object.keys(AGENT_CONFIG) as Array<keyof typeof AGENT_CONFIG>).map((role) => {
          const config = AGENT_CONFIG[role];
          const Icon = config.icon;
          const isActive = session?.messages?.some((m) => m.agent === role) ?? false;
          const isCurrentlyTyping =
            session?.status === 'running' &&
            session.messages.at(-1)?.agent === role;

          return (
            <Card key={role} className={`border ${isActive ? config.bg : 'bg-muted/20'} transition-all`}>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? config.color : 'text-muted-foreground'}`} />
                  {isCurrentlyTyping && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isActive ? config.color : 'text-muted-foreground'}`}>
                    {config.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isCurrentlyTyping ? 'active...' : isActive ? 'done' : 'idle'}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <label className="text-sm font-medium">Treasury Goal</label>
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Describe your complex treasury management goal..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || polling}
            />
            <Button
              onClick={startSwarm}
              disabled={loading || polling || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700 px-6"
            >
              {loading || polling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Deploy Swarm
                </>
              )}
            </Button>
          </div>

          {/* Example prompts */}
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="text-xs bg-muted/50 hover:bg-muted px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors text-left"
                disabled={polling}
              >
                {ex.slice(0, 55)}...
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Message Board */}
      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Chat */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              <h2 className="font-semibold">Agent Message Board</h2>
              <StatusBadge status={session.status} />
              {session.debateRound > 0 && (
                <Badge variant="outline" className="border-orange-500 text-orange-500">
                  Debate Round {session.debateRound}
                </Badge>
              )}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {session.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>

              {(session.status === 'running' || session.status === 'debating') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-muted-foreground text-sm px-4 py-2"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Agents working...
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Sidebar: Proposals + Decision */}
          <div className="space-y-4">
            {/* Proposals */}
            {session.proposals.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Yield Proposals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {session.proposals.map((p, i) => {
                    const risk = session.riskAssessments.find((r) => r.protocol === p.protocol);
                    return (
                      <div key={i} className="text-xs border rounded-md p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.pool}</span>
                          <span className="text-green-400">{p.apy.toFixed(1)}% APY</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{p.protocol}</span>
                          {risk && (
                            <Badge
                              className={`text-[10px] h-4 ${
                                risk.vetoed ? 'bg-red-500' : risk.tier === 'CAUTION' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                            >
                              {risk.vetoed ? 'VETOED' : risk.tier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Human Decision Panel */}
            {session.status === 'awaiting_human' && !session.humanDecision && (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <Card className="border-orange-500/50 bg-orange-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-400" />
                      Human Decision Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {session.complianceResult?.reason || 'The swarm requires your approval to proceed.'}
                    </p>
                    {session.formattedTx && (
                      <div className="text-xs bg-muted/50 rounded p-2">
                        <p className="font-medium mb-1">Transaction Summary</p>
                        <p className="text-muted-foreground">{session.formattedTx.description}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleHumanDecision('approved')}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleHumanDecision('rejected')}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Final outcome */}
            {session.status === 'complete' && session.humanDecision && (
              <Card
                className={
                  session.humanDecision === 'approved'
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-red-500/50 bg-red-500/5'
                }
              >
                <CardContent className="p-4 text-center">
                  {session.humanDecision === 'approved' ? (
                    <>
                      <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="font-semibold text-green-400">Transaction Approved</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted to Somnia blockchain
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                      <p className="font-semibold text-red-400">Transaction Rejected</p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Compliance report */}
            {session.complianceResult && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Compliance Checks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {session.complianceResult.checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {c.passed ? (
                        <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <span className={c.passed ? 'text-muted-foreground' : 'text-red-400'}>{c.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const config = AGENT_CONFIG[message.agent];
  const Icon = config.icon;

  const isVeto = message.type === 'veto';
  const isEscalation = message.type === 'escalation';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${config.bg} ${isVeto ? 'border-red-500/60' : ''} ${isEscalation ? 'border-orange-500/60' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1 rounded-full ${config.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <span className={`text-xs font-semibold ${config.color}`}>{config.label} Agent</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
        {isVeto && <Badge className="bg-red-500 text-[10px] h-4">VETO</Badge>}
        {isEscalation && <Badge className="bg-orange-500 text-[10px] h-4">ESCALATED</Badge>}
        {message.type === 'consensus' && <Badge className="bg-green-500 text-[10px] h-4">CONSENSUS</Badge>}
        {message.roundNumber && (
          <Badge variant="outline" className="text-[10px] h-4">Round {message.roundNumber}</Badge>
        )}
      </div>
      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{message.content}</p>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: SwarmSession['status'] }) {
  const map = {
    running: { label: 'Running', class: 'bg-blue-500 animate-pulse' },
    debating: { label: 'Debating', class: 'bg-orange-500 animate-pulse' },
    awaiting_human: { label: 'Awaiting Human', class: 'bg-yellow-500' },
    complete: { label: 'Complete', class: 'bg-green-500' },
    failed: { label: 'Failed', class: 'bg-red-500' },
  };
  const cfg = map[status];
  return <Badge className={`${cfg.class} text-[10px]`}>{cfg.label}</Badge>;
}
