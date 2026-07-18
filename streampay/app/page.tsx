'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Brain, ShieldAlert, TrendingUp, Cpu, Scale,
  Swords, FlaskConical, ArrowRight, Zap, Users, CheckCircle,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const AGENTS = [
  {
    role: 'Manager',
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    model: 'Qwen-Max',
    desc: 'Parses treasury goals, decomposes tasks, mediates debate rounds, routes to human when stuck.',
  },
  {
    role: 'Analyst',
    icon: TrendingUp,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    model: 'Qwen-Turbo',
    desc: 'Queries Somnia Exchange & Potion Swap DEX APIs to find highest-APY yield pools matching the goal.',
  },
  {
    role: 'Risk',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    model: 'Qwen-Turbo',
    desc: 'Consults SomniaAgentRiskOracle.sol for audit scores, TVL history & exploit probability. Issues vetoes.',
  },
  {
    role: 'Execution',
    icon: Cpu,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    model: 'Qwen-Turbo',
    desc: 'Formats approved strategy as a gas-optimized Multicall3 transaction ready for on-chain submission.',
  },
  {
    role: 'Compliance',
    icon: Scale,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    model: 'Rules Engine',
    desc: 'Verifies the final transaction against TreasuryPolicy.sol — daily limits, allowlists, multisig threshold.',
  },
];

const FLOW = [
  { step: 1, label: 'User inputs complex goal', color: 'bg-gray-500' },
  { step: 2, label: 'Manager decomposes → parallel tasks', color: 'bg-purple-500' },
  { step: 3, label: 'Analyst + Risk run in parallel', color: 'bg-blue-500' },
  { step: 4, label: 'Risk vetoes? → 2-round debate', color: 'bg-orange-500' },
  { step: 5, label: 'No consensus? → Escalate to human', color: 'bg-yellow-500' },
  { step: 6, label: 'Execution formats multicall tx', color: 'bg-green-500' },
  { step: 7, label: 'Compliance checks TreasuryPolicy', color: 'bg-teal-500' },
  { step: 8, label: 'Human approves → on-chain', color: 'bg-purple-600' },
];

export default function HomePage() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-12 py-4">
      {/* Hero */}
      <motion.div variants={itemVariants} className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Zap className="h-10 w-10 text-purple-400" />
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            SyndiChain
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The Multi-Agent DAO Treasury Swarm — a society of specialized AI agents that collaborate,
          debate, and safely execute complex DeFi strategies on Somnia.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild size="lg" className="bg-purple-600 hover:bg-purple-700">
            <Link href="/war-room">
              <Swords className="h-5 w-5 mr-2" />
              Open War Room
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/benchmark">
              <FlaskConical className="h-5 w-5 mr-2" />
              View Benchmark
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Agent Society */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold mb-4 text-center">The Agent Society</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card key={agent.role} className={`border ${agent.bg}`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${agent.color}`} />
                    <CardTitle className={`text-sm ${agent.color}`}>{agent.role}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] w-fit">{agent.model}</Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground">{agent.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Execution flow */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold mb-4 text-center">Swarm Execution Flow</h2>
        <div className="flex flex-wrap justify-center gap-2 items-center">
          {FLOW.map((step, i) => (
            <div key={step.step} className="flex items-center gap-2">
              <div className={`rounded-full ${step.color} text-white text-xs font-bold h-6 w-6 flex items-center justify-center shrink-0`}>
                {step.step}
              </div>
              <span className="text-xs text-muted-foreground max-w-[120px] text-center">{step.label}</span>
              {i < FLOW.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Innovation highlight */}
      <motion.div variants={itemVariants}>
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              The Conflict Resolution Protocol
            </CardTitle>
            <CardDescription>What makes SyndiChain different from a single-agent LLM</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: '1. Veto Issued',
                desc: 'Risk Agent flags a proposal with riskScore > 70 and issues a structured veto with quantified exploit probability.',
                icon: ShieldAlert,
                color: 'text-red-400',
              },
              {
                title: '2. Debate Rounds',
                desc: 'Analyst cites 3 data points. Risk quantifies its counter. Manager mediates up to 2 rounds seeking consensus.',
                icon: Brain,
                color: 'text-purple-400',
              },
              {
                title: '3. Human Tie-Break',
                desc: 'If no consensus after 2 rounds, Manager escalates with both sides presented for human decision via the War Room.',
                icon: CheckCircle,
                color: 'text-green-400',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="p-4 rounded-lg bg-background/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                    <p className="font-semibold text-sm">{item.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Contracts */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold mb-4 text-center">On-Chain Infrastructure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'TreasuryPolicy.sol',
              desc: 'Hard policy enforcement — daily limits, protocol allowlists, multisig thresholds. The Compliance Agent reads this before every transaction.',
              network: 'Somnia Testnet',
            },
            {
              name: 'SomniaAgentRiskOracle.sol',
              desc: 'On-chain risk registry for Somnia DeFi protocols — audit scores, TVL history, incident records. The Risk Agent queries this.',
              network: 'Somnia Testnet',
            },
            {
              name: 'StreamPay.sol',
              desc: 'Existing streaming contract powering payroll disbursements. Integrated into treasury strategy when user needs liquid payroll reserves.',
              network: 'Somnia Testnet',
            },
          ].map((c) => (
            <Card key={c.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono text-purple-400">{c.name}</CardTitle>
                <Badge variant="outline" className="text-[10px] w-fit">{c.network}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
