export type AgentRole = 'manager' | 'analyst' | 'risk' | 'execution' | 'compliance';

export type MessageType =
  | 'task_decomposition'
  | 'yield_data'
  | 'risk_assessment'
  | 'veto'
  | 'debate_argument'
  | 'debate_response'
  | 'consensus'
  | 'escalation'
  | 'tx_formatted'
  | 'compliance_check'
  | 'approved'
  | 'rejected'
  | 'human_decision';

export interface AgentMessage {
  id: string;
  agent: AgentRole;
  type: MessageType;
  content: string;
  data?: Record<string, unknown>;
  timestamp: number;
  roundNumber?: number;
}

export interface SubTask {
  id: string;
  assignedTo: AgentRole;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface YieldOpportunity {
  protocol: string;
  pool: string;
  apy: number;
  tvl: number;
  token: string;
  contractAddress: string;
  audited: boolean;
  auditFirms: string[];
}

export interface RiskAssessment {
  protocol: string;
  riskScore: number; // 0-100, higher = riskier
  tier: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'UNKNOWN';
  vetoed: boolean;
  reasons: string[];
  exploitProbability?: number; // 0-1, from debate round
}

export interface FormattedTransaction {
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
  description: string;
  calls: MulticallEntry[];
}

export interface MulticallEntry {
  target: string;
  callData: string;
  value: string;
  label: string;
}

export interface ComplianceResult {
  compliant: boolean;
  reason: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface SwarmSession {
  id: string;
  userPrompt: string;
  status: 'running' | 'debating' | 'awaiting_human' | 'complete' | 'failed';
  messages: AgentMessage[];
  subTasks: SubTask[];
  proposals: YieldOpportunity[];
  riskAssessments: RiskAssessment[];
  formattedTx?: FormattedTransaction;
  complianceResult?: ComplianceResult;
  humanDecision?: 'approved' | 'rejected';
  startedAt: number;
  completedAt?: number;
  debateRound: number;
}
