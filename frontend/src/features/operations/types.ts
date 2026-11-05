export interface PolicyInput {
  name: string;
  max_amount: string;
  allowed_tokens: string[];
  allowed_recipients: string[];
  allowed_operations: string[];
}

export interface PolicyRecord extends PolicyInput {
  id: string;
  created_at: string;
}

export interface OperationInput {
  agent_id: string;
  policy_id: string;
  network: "near-testnet";
  operation: string;
  token: string;
  amount: string;
  recipient: string;
}

export interface OperationRecord extends OperationInput {
  operation_id: string;
  created_at: string;
  decision: "approved" | "rejected";
  reason: string;
  policy_name: string;
  policy_snapshot: PolicyRecord;
  checks: { code: string; label: string; passed: boolean; detail: string }[];
  risk_score: number | null;
  risk_analysis_status: "unavailable";
  requires_signature: boolean | null;
  verification_status: "not_performed";
  execution_status: "not_submitted";
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
