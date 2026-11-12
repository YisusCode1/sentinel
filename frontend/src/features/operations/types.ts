export interface PolicyInput {
  name: string;
  max_amount: string;
  allowed_tokens: string[];
  allowed_recipients: string[];
  allowed_operations: string[];
}

export interface PolicyRecord extends PolicyInput {
  id: string;
  active?: boolean;
  created_at?: string;
}

export interface OperationInput {
  policy_id: string;
  network: string;
  operation: string;
  token: string;
  amount: string;
  recipient: string;
}

export interface AIAnalysis {
  risk_level: "low" | "medium" | "high" | "critical" | "unknown";
  risk_score: number;
  flags: string[];
  explanation: string;
  evidence: string[];
  analysis_available: boolean;
  model_used?: string | null;
  latency_ms?: number | null;
}

export interface OperationDecision {
  operation_id: string;
  decision: "approved" | "rejected";
  reason: string;
  policy_id: string;
  ai_analysis?: AIAnalysis | null;
}

export interface OperationRecord {
  id: string;
  operation_id?: string;
  agent_id: string;
  policy_id: string;
  network: string;
  operation: string;
  token: string;
  amount: string;
  recipient: string;
  decision: "approved" | "rejected";
  reason: string;
  created_at: string;
  ai_analysis?: AIAnalysis | null;
}

export interface OperationPage {
  items: OperationRecord[];
  total: number;
  page: number;
  page_size: number;
  summary: { total: number; approved: number; rejected: number };
}

export interface OperationFilters {
  q: string;
  decision: "" | "approved" | "rejected";
  date_from: string;
  date_to: string;
}
