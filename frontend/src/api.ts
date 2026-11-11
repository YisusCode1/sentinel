const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001').replace(/\/$/, '');

export interface Analysis {
  risk_score: number; risk_level: string; explanation: string; flags: string[];
  evidence: string[]; analysis_available: boolean; model_used: string | null;
}
export interface Policy {
  id: string; name: string; max_amount: string; active: boolean;
  allowed_tokens: string[]; allowed_recipients: string[]; allowed_operations: string[];
}
export interface Operation {
  id: string; amount: string; token: string; recipient: string; policy_id: string;
  decision: 'approved' | 'rejected'; reason: string; ai_analysis: Analysis | null;
  created_at: string;
}
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatReply {
  reply: string; mode: 'llm' | 'demo' | 'unavailable'; warnings: string[];
  suggested_rules: string[]; model_used: string | null;
}

export async function api<T>(path: string, key = '', body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(key ? { 'X-API-Key': key } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Solicitud inválida (${response.status})`);
  return data as T;
}
