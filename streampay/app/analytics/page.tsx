'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SwarmSession } from '@/lib/agents/types';
import {
  Activity, TrendingUp, Zap, ShieldAlert, Brain,
  BarChart3, CheckCircle, XCircle, Clock, Swords,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface SwarmStats {
  totalSessions: number;
  completed: number;
  failed: number;
  totalMessages: number;
  totalDebateRounds: number;
  humanApprovals: number;
  humanRejections: number;
  avgMessages: number;
  agentActivity: { name: string; messages: number; color: string }[];
  sessionHistory: { label: string; messages: number; status: string }[];
  recentSessions: SwarmSession[];
}

function computeStats(sessions: SwarmSession[]): SwarmStats {
  const completed = sessions.filter(s => s.status === 'complete').length;
  const failed = sessions.filter(s => s.status === 'failed').length;
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalDebateRounds = sessions.reduce((sum, s) => sum + (s.debateRound ?? 0), 0);
  const humanApprovals = sessions.filter(s => s.humanDecision === 'approved').length;
  const humanRejections = sessions.filter(s => s.humanDecision === 'rejected').length;

  const agentCounts = { manager: 0, analyst: 0, risk: 0, execution: 0, compliance: 0 };
  sessions.forEach(s => s.messages.forEach(m => { agentCounts[m.agent] = (agentCounts[m.agent] ?? 0) + 1; }));

  const agentActivity = [
    { name: 'Manager', messages: agentCounts.manager, color: '#a855f7' },
    { name: 'Analyst', messages: agentCounts.analyst, color: '#3b82f6' },
    { name: 'Risk', messages: agentCounts.risk, color: '#ef4444' },
    { name: 'Execution', messages: agentCounts.execution, color: '#22c55e' },
    { name: 'Compliance', messages: agentCounts.compliance, color: '#eab308' },
  ];

  const sessionHistory = sessions.slice(0, 8).reverse().map((s, i) => ({
    label: `Run ${i + 1}`,
    messages: s.messages.length,
    status: s.status,
  }));

  return {
    totalSessions: sessions.length,
    completed,
    failed,
    totalMessages,
    totalDebateRounds,
    humanApprovals,
    humanRejections,
    avgMessages: sessions.length ? Math.round(totalMessages / sessions.length) : 0,
    agentActivity,
    sessionHistory,
    recentSessions: sessions.slice(0, 5),
  };
}

const outcomeData = (stats: SwarmStats) => [
  { name: 'Approved', value: stats.humanApprovals, color: '#22c55e' },
  { name: 'Rejected', value: stats.humanRejections, color: '#ef4444' },
  { name: 'In Progress', value: stats.totalSessions - stats.completed - stats.failed, color: '#3b82f6' },
].filter(d => d.value > 0);

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<SwarmSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/swarm')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats = computeStats(sessions);
  const pie = outcomeData(stats);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          SyndiChain Analytics
        </h1>
        <p className="text-muted-foreground">Live swarm session performance across all War Room runs</p>
      </motion.div>

      {loading ? (
        <div className="text-center text-muted-foreground py-20">Loading session data...</div>
      ) : stats.totalSessions === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-12 text-center space-y-3">
              <Swords className="h-12 w-12 text-purple-400 mx-auto" />
              <p className="text-lg font-semibold">No swarm sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Run a swarm in the <a href="/war-room" className="text-purple-400 underline">War Room</a> to start seeing analytics.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                <Brain className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-400">{stats.totalSessions}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats.completed} completed · {stats.failed} failed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Agent Messages</CardTitle>
                <Activity className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-400">{stats.totalMessages}</div>
                <p className="text-xs text-muted-foreground mt-1">~{stats.avgMessages} per session</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Debate Rounds</CardTitle>
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">{stats.totalDebateRounds}</div>
                <p className="text-xs text-muted-foreground mt-1">Risk veto triggers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Human Approvals</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">{stats.humanApprovals}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats.humanRejections} rejected</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agent Activity */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                    Agent Activity
                  </CardTitle>
                  <CardDescription>Total messages sent per agent across all sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.agentActivity}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="messages" radius={[4, 4, 0, 0]}>
                          {stats.agentActivity.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Outcome Distribution */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    Governance Outcomes
                  </CardTitle>
                  <CardDescription>Human approval decisions across all swarm runs</CardDescription>
                </CardHeader>
                <CardContent>
                  {pie.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pie}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                            labelLine={false}
                          >
                            {pie.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      No governance decisions yet — approve or reject a swarm proposal
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Session history bar chart */}
            {stats.sessionHistory.length > 0 && (
              <motion.div variants={itemVariants} className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                      Messages per Session
                    </CardTitle>
                    <CardDescription>Agent message volume for each swarm run (most recent 8)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.sessionHistory}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="messages" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Recent Sessions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs border rounded-md px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-foreground/80">{s.userPrompt}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {s.messages.length} messages · {s.debateRound > 0 ? `${s.debateRound} debate round(s) · ` : ''}
                        {new Date(s.startedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      {s.humanDecision === 'approved' && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                      {s.humanDecision === 'rejected' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                      <Badge
                        className={`text-[10px] ${
                          s.status === 'complete' ? 'bg-green-500' :
                          s.status === 'failed' ? 'bg-red-500' :
                          s.status === 'running' || s.status === 'debating' ? 'bg-blue-500 animate-pulse' :
                          'bg-yellow-500'
                        }`}
                      >
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
