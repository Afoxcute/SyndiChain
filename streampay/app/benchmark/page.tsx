'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
} from 'recharts';
import { TrendingUp, Shield, Zap, CheckCircle, AlertTriangle, Play, Loader2, Code2 } from 'lucide-react';

interface AggregateData {
  provider: string;
  aggregateTrials: number;
  singleAgent: MetricSet;
  swarm: MetricSet;
  speedupFactor: number;
  safetyImprovement: number;
  methodology: string[];
}

interface MetricSet {
  label: string;
  description: string;
  safeTransactionRate: number;
  hallucinatedPoolRate: number;
  incorrectFormatRate: number;
  avgTimeSeconds: number;
  riskMissRate: number;
  avgGasEstimateError: number;
}

interface LiveResult {
  prompt: string;
  llmProvider: string;
  timestamp: number;
  singleAgent: {
    label: string; timeMs: number; safeTransaction: boolean;
    hallucinatedPool: boolean; txFormatCorrect: boolean;
    riskFlagsFound: number; poolsProposed: number;
  };
  swarm: {
    label: string; timeMs: number; safeTransaction: boolean;
    vetoedProposals: number; safeProposals: number;
    debateTriggered: boolean; caughtAllRisks: boolean; txFormatCorrect: boolean;
  };
  speedupFactor: string;
  winner: string;
}

const LIVE_PROMPTS = [
  'Diversify 50,000 STT into yield-bearing assets, keep 10,000 liquid for payroll, hedge against volatility',
  'Deploy 20,000 STT into the safest pools only — maximize safety over yield',
  'Maximize APY for 30,000 STT — any protocol is fine',
];

export default function BenchmarkPage() {
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [running, setRunning] = useState(false);
  const [livePrompt, setLivePrompt] = useState(LIVE_PROMPTS[0]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch('/api/benchmark').then(r => r.json()).then(setAggregate);
  }, []);

  async function runLiveBenchmark() {
    setRunning(true);
    setLiveResult(null);
    try {
      const res = await fetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: livePrompt }),
      });
      if (res.ok) setLiveResult(await res.json());
    } finally {
      setRunning(false);
    }
  }

  if (!aggregate) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground animate-pulse">Loading benchmark data...</div>;
  }

  const { singleAgent: s, swarm: sw } = aggregate;

  const barData = [
    { metric: 'Safe Tx Rate',   'Single Agent': Math.round(s.safeTransactionRate * 100),  SyndiChain: Math.round(sw.safeTransactionRate * 100) },
    { metric: 'Hallucination',  'Single Agent': Math.round(s.hallucinatedPoolRate * 100),  SyndiChain: Math.round(sw.hallucinatedPoolRate * 100) },
    { metric: 'Format Error',   'Single Agent': Math.round(s.incorrectFormatRate * 100),   SyndiChain: Math.round(sw.incorrectFormatRate * 100) },
    { metric: 'Risk Miss Rate', 'Single Agent': Math.round(s.riskMissRate * 100),           SyndiChain: Math.round(sw.riskMissRate * 100) },
  ];

  const radarData = [
    { axis: 'Safety',        'Single Agent': Math.round(s.safeTransactionRate * 100), SyndiChain: Math.round(sw.safeTransactionRate * 100) },
    { axis: 'Accuracy',      'Single Agent': Math.round((1 - s.hallucinatedPoolRate) * 100), SyndiChain: Math.round((1 - sw.hallucinatedPoolRate) * 100) },
    { axis: 'Tx Format',     'Single Agent': Math.round((1 - s.incorrectFormatRate) * 100), SyndiChain: Math.round((1 - sw.incorrectFormatRate) * 100) },
    { axis: 'Risk Detection','Single Agent': Math.round((1 - s.riskMissRate) * 100), SyndiChain: Math.round((1 - sw.riskMissRate) * 100) },
    { axis: 'Gas Accuracy',  'Single Agent': Math.round((1 - s.avgGasEstimateError) * 100), SyndiChain: Math.round((1 - sw.avgGasEstimateError) * 100) },
  ];

  const kpis = [
    { icon: Shield,      color: 'text-green-400',  label: 'Safe Tx Rate',     single: `${Math.round(s.safeTransactionRate * 100)}%`,  swarm: `${Math.round(sw.safeTransactionRate * 100)}%`, delta: `+${Math.round(aggregate.safetyImprovement * 100)}pp` },
    { icon: Zap,         color: 'text-blue-400',   label: 'Avg Speed',        single: `${s.avgTimeSeconds}s`,  swarm: `${sw.avgTimeSeconds}s`, delta: `${aggregate.speedupFactor}x faster` },
    { icon: TrendingUp,  color: 'text-purple-400', label: 'Hallucination',    single: `${Math.round(s.hallucinatedPoolRate * 100)}%`, swarm: `${Math.round(sw.hallucinatedPoolRate * 100)}%`, delta: `-${Math.round((s.hallucinatedPoolRate - sw.hallucinatedPoolRate) * 100)}pp` },
    { icon: CheckCircle, color: 'text-yellow-400', label: 'Risk Miss Rate',   single: `${Math.round(s.riskMissRate * 100)}%`, swarm: `${Math.round(sw.riskMissRate * 100)}%`, delta: `-${Math.round((s.riskMissRate - sw.riskMissRate) * 100)}pp` },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Benchmark: Swarm vs Single Agent
        </h1>
        <p className="text-muted-foreground mt-2">
          Aggregate results ({aggregate.aggregateTrials} trials) + live head-to-head run
        </p>
        {aggregate.provider !== 'none' && (
          <div className="flex justify-center mt-1">
            <Badge variant="outline" className="text-[10px]">
              Provider: {aggregate.provider === 'qwen' ? 'Qwen (Max/Turbo)' : 'Claude (Sonnet/Haiku)'}
            </Badge>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="text-center">
              <CardContent className="p-4">
                <Icon className={`h-6 w-6 ${item.color} mx-auto mb-2`} />
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground line-through">{item.single}</span>
                  <span className="text-sm font-bold">{item.swarm}</span>
                </div>
                <Badge className="mt-1 text-[10px] bg-green-500/20 text-green-400 border-green-500/30">{item.delta}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Error Rate Comparison (%)</CardTitle>
            <CardDescription>Lower is better</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} barGap={4}>
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="Single Agent" fill="hsl(0 70% 55%)" radius={4} />
                <Bar dataKey="SyndiChain" fill="hsl(142 70% 45%)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capability Radar</CardTitle>
            <CardDescription>Higher is better</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                <Radar name="Single Agent" dataKey="Single Agent" stroke="hsl(0 70% 55%)" fill="hsl(0 70% 55%)" fillOpacity={0.2} />
                <Radar name="SyndiChain" dataKey="SyndiChain" stroke="hsl(142 70% 45%)" fill="hsl(142 70% 45%)" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Live Benchmark Runner ───────────────────────────────────────────────── */}
      <Card className="border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-purple-400" />
            Live Head-to-Head Run
          </CardTitle>
          <CardDescription>
            Run the same prompt through a single LLM and the full swarm simultaneously and compare outputs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Prompt</label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={livePrompt}
                onChange={e => setLivePrompt(e.target.value)}
                disabled={running}
              >
                {LIVE_PROMPTS.map((p, i) => <option key={i} value={p}>{p.slice(0, 70)}...</option>)}
              </select>
              <Button
                onClick={runLiveBenchmark}
                disabled={running || aggregate.provider === 'none'}
                className="bg-purple-600 hover:bg-purple-700 shrink-0"
              >
                {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Play className="h-4 w-4 mr-2" />Run Now</>}
              </Button>
            </div>
            {aggregate.provider === 'none' && (
              <p className="text-xs text-yellow-400">⚠️ No LLM API key configured — live runs unavailable</p>
            )}
          </div>

          <AnimatePresence>
            {liveResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Results</p>
                  <div className="flex items-center gap-2">
                    <Badge className={liveResult.winner === 'swarm' ? 'bg-green-500' : 'bg-yellow-500'}>
                      {liveResult.winner === 'swarm' ? '✅ Swarm wins' : '⚠️ Tie'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)} className="text-xs gap-1">
                      <Code2 className="h-3 w-3" />
                      {showRaw ? 'Hide JSON' : 'Raw JSON'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ResultCard
                    label={liveResult.singleAgent.label}
                    items={[
                      { label: 'Time', value: `${(liveResult.singleAgent.timeMs / 1000).toFixed(1)}s` },
                      { label: 'Safe Tx', value: liveResult.singleAgent.safeTransaction ? '✅' : '❌' },
                      { label: 'Hallucinated Pool', value: liveResult.singleAgent.hallucinatedPool ? '❌ Yes' : '✅ No' },
                      { label: 'Tx Format OK', value: liveResult.singleAgent.txFormatCorrect ? '✅' : '❌' },
                      { label: 'Risk Flags Found', value: String(liveResult.singleAgent.riskFlagsFound) },
                    ]}
                    safe={liveResult.singleAgent.safeTransaction}
                  />
                  <ResultCard
                    label={liveResult.swarm.label}
                    items={[
                      { label: 'Time', value: `${(liveResult.swarm.timeMs / 1000).toFixed(1)}s` },
                      { label: 'Safe Tx', value: liveResult.swarm.safeTransaction ? '✅' : '❌' },
                      { label: 'Pools Vetoed', value: String(liveResult.swarm.vetoedProposals) },
                      { label: 'Debate Triggered', value: liveResult.swarm.debateTriggered ? '✅ Yes' : '—' },
                      { label: 'Caught All Risks', value: liveResult.swarm.caughtAllRisks ? '✅' : '❌' },
                    ]}
                    safe={liveResult.swarm.safeTransaction}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Swarm was{' '}
                  <span className="text-green-400 font-medium">{liveResult.speedupFactor}x</span>{' '}
                  {parseFloat(liveResult.speedupFactor) >= 1 ? 'faster' : 'slower (parallelism overhead)'} than single agent
                </p>

                {showRaw && (
                  <pre className="text-[10px] bg-muted/50 rounded p-3 overflow-auto max-h-64">
                    {JSON.stringify(liveResult, null, 2)}
                  </pre>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Methodology */}
      <Card>
        <CardHeader><CardTitle>Methodology</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {aggregate.methodology.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-purple-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({ label, items, safe }: {
  label: string;
  items: { label: string; value: string }[];
  safe: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${safe ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <p className="text-xs font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
