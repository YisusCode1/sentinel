import AnimatedState from '../../components/ui/AnimatedState';
import { useToast } from '../../components/ui/ToastProvider';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { ResultSkeleton } from '../../components/ui/Skeleton';
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, CircleSlash, ExternalLink, Key, RefreshCw, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { displayDate } from "./utils";
import type { AIAnalysis, OperationRecord, PolicyRecord } from "./types";

export function DecisionBadge({ decision }: { decision: OperationRecord["decision"] }) {
  return (
    <span className={`ops-decision ${decision}`}>
      {decision === "approved" ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <XCircle size={14} aria-hidden="true" />
      )}
      {decision === "approved" ? "Aprobada por política" : "Rechazada por política"}
    </span>
  );
}

function RiskLevelBadge({ level }: { level: AIAnalysis["risk_level"] }) {
  const toneMap: Record<AIAnalysis["risk_level"], { label: string; className: string }> = {
    low: { label: "Riesgo Bajo", className: "badge-pill succ" },
    medium: { label: "Riesgo Medio", className: "badge-pill warn" },
    high: { label: "Riesgo Alto", className: "badge-pill crit" },
    critical: { label: "Riesgo Crítico", className: "badge-pill crit" },
    unknown: { label: "No evaluado", className: "badge-pill inf" },
  };
  const config = toneMap[level] || toneMap.unknown;
  return (
    <span className={config.className}>{config.label}</span>
  );
}

function RiskRadialGauge({ score }: { score: number }) {
  const radius = 36;
  const arcLength = Math.PI * radius; // ~113.1
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = arcLength - (clampedScore / 100) * arcLength;

  const color =
    clampedScore <= 30
      ? "var(--azul-marca, #06b6d4)"
      : clampedScore <= 65
      ? "var(--amarillo-alerta, #f59e0b)"
      : "var(--rojo-critico, #ef4444)";

  return (
    <div style={{ position: "relative", width: 92, height: 52, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="92" height="52" viewBox="0 0 92 52" aria-hidden="true">
        <path
          d="M 10 46 A 36 36 0 0 1 82 46"
          fill="none"
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10 46 A 36 36 0 0 1 82 46"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div style={{ position: "absolute", bottom: 0, textAlign: "center", lineHeight: 1 }}>
        <span className="numeric" style={{ fontSize: "1.15rem", fontWeight: 700, color }}>{clampedScore}</span>
        <span style={{ fontSize: "0.62rem", color: "#64748b" }}>/100</span>
      </div>
    </div>
  );
}

function PipelineStepper({ record }: { record: OperationRecord }) {
  const isApproved = record.decision === "approved";
  const hasAi = Boolean(record.ai_analysis && record.ai_analysis.risk_level !== "unknown");

  return (
    <div className="ops-pipeline-stepper" role="region" aria-label="Flujo de validación de seguridad">
      <div className="pipeline-steps-grid">
        <div className="pipeline-step completed">
          <div className="step-icon-wrap">
            <Key size={13} aria-hidden="true" />
          </div>
          <div className="step-content">
            <span className="step-label">1. Identidad</span>
            <strong className="step-status">X-API-Key OK</strong>
          </div>
        </div>

        <div className={`pipeline-connector ${isApproved ? "approved" : "rejected"}`} aria-hidden="true" />

        <div className={`pipeline-step ${isApproved ? "completed" : "failed"}`}>
          <div className="step-icon-wrap">
            {isApproved ? <ShieldCheck size={13} aria-hidden="true" /> : <ShieldAlert size={13} aria-hidden="true" />}
          </div>
          <div className="step-content">
            <span className="step-label">2. Policy Engine</span>
            <strong className="step-status">{isApproved ? "Cumple regla" : "Incumple regla"}</strong>
          </div>
        </div>

        <div className={`pipeline-connector ${isApproved ? "approved" : "neutral"}`} aria-hidden="true" />

        <div className={`pipeline-step ${hasAi ? "completed" : "neutral"}`}>
          <div className="step-icon-wrap">
            <Bot size={13} aria-hidden="true" />
          </div>
          <div className="step-content">
            <span className="step-label">3. Gemini AI</span>
            <strong className="step-status">
              {hasAi ? `${record.ai_analysis?.risk_score}/100 score` : (isApproved ? "Consultivo" : "Standby")}
            </strong>
          </div>
        </div>

        <div className={`pipeline-connector ${isApproved ? "approved" : "rejected"}`} aria-hidden="true" />

        <div className={`pipeline-step ${isApproved ? "completed" : "failed"}`}>
          <div className="step-icon-wrap">
            {isApproved ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
          </div>
          <div className="step-content">
            <span className="step-label">4. Veredicto</span>
            <strong className="step-status">{isApproved ? "AUTORIZADA" : "DENEGADA"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NearExplorerLink({ address }: { address: string }) {
  const isNear = address.endsWith(".testnet") || address.endsWith(".near") || address.length === 64;
  if (!isNear) {
    return <span className="contract-address">{address}</span>;
  }
  return (
    <a
      href={`https://testnet.nearblocks.io/address/${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="contract-address near-explorer-link"
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      title="Consultar cuenta en NEARBlocks Testnet Explorer"
    >
      <span>{address}</span>
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function AIAnalysisPanel({ analysis }: { analysis?: AIAnalysis | null }) {
  if (!analysis || analysis.risk_level === "unknown" || !analysis.analysis_available) {
    return (
      <div className="ops-analysis-note">
        <CircleSlash size={16} aria-hidden="true" />
        <div>
          <strong>Análisis de riesgo IA no disponible</strong>
          <p>
            {analysis?.explanation || "La decisión fue tomada de forma determinista por el Policy Engine. El motor de IA actúa exclusivamente como asesor de riesgo."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-ai-panel" style={{ border: "1px solid rgba(148, 163, 184, 0.15)", background: "rgba(10, 16, 26, 0.7)", borderRadius: 12, padding: "16px", marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingBottom: 12, borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(6, 182, 212, 0.12)", border: "1px solid rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={20} style={{ color: "var(--azul-marca, #06b6d4)" }} aria-hidden="true" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Asesor de Riesgo (Gemini AI)</h4>
            <div style={{ marginTop: 2 }}>
              <RiskLevelBadge level={analysis.risk_level} />
            </div>
          </div>
        </div>

        <RiskRadialGauge score={analysis.risk_score} />
      </div>

      <p style={{ margin: "14px 0 8px 0", fontSize: "0.85rem", color: "var(--color-text-secondary, #cbd5e1)", lineHeight: 1.5 }}>
        {analysis.explanation}
      </p>

      {analysis.flags && analysis.flags.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>Señales detectadas:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {analysis.flags.map((flag, idx) => (
              <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(30, 41, 59, 0.8)", fontSize: "0.75rem", color: "#67e8f9", border: "1px solid rgba(51, 65, 85, 0.6)", fontFamily: "monospace" }}>
                <AlertCircle size={12} style={{ color: "#f59e0b" }} />
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.evidence && analysis.evidence.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>Evidencia observada:</span>
          <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, fontSize: "0.8rem", color: "#cbd5e1" }}>
            {analysis.evidence.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 2 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#64748b", marginTop: 12, paddingTop: 8, borderTop: "1px solid rgba(148, 163, 184, 0.08)" }}>
        <span>Asesor de riesgo consultivo · La decisión es autoritativa del Policy Engine</span>
        {analysis.latency_ms !== undefined && analysis.latency_ms !== null && (
          <span style={{ fontFamily: "monospace" }}>Latencia: {analysis.latency_ms} ms</span>
        )}
      </div>
    </div>
  );
}

interface Props {
  record: OperationRecord | null;
  pending: boolean;
  error: string;
  onNavigateToPolicy?: (policyId: string) => void;
  onClose?: () => void;
}

export default function OperationResult({
  record,
  pending,
  error,
  onNavigateToPolicy,
  onClose,
}: Props) {
  const headingId = useId();
  const operationId = record ? (record.operation_id || record.id || "op-active") : "";

  return (
    <Card className="card ops-result" aria-labelledby={headingId} aria-busy={pending}>
      <div className="card-header-row">
        <h3 id={headingId}>
          <ShieldCheck size={18} aria-hidden="true" />
          Resultado de evaluación
        </h3>
        {onClose && (
          <button
            type="button"
            className="ops-icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle de evaluación"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <AnimatedState stateKey={pending ? 'loading' : error ? 'error' : record ? operationId : 'empty'}>
        {pending ? (
        <ResultSkeleton />
      ) : error ? (
        <p className="ops-message error" role="alert">
          {error}
        </p>
      ) : !record ? (
        <div className="ops-empty">
          <ShieldCheck size={32} strokeWidth={1.25} />
          <h4>Listo para evaluar</h4>
          <p>Completa la operación o selecciona un escenario demo arriba para consultar sus controles y resultado.</p>
        </div>
      ) : (
        <>
          <div className="ops-result-verdict" role="status">
            <DecisionBadge decision={record.decision} />
            <p>{record.reason}</p>
          </div>

          {/* Stepper Visual de la Arquitectura de Seguridad */}
          <PipelineStepper record={record} />

          <dl className="ops-detail-grid">
            <div className="ops-span-full">
              <dt>Identificador de operación</dt>
              <dd className="contract-address numeric">{record.id || record.operation_id}</dd>
            </div>
            <div>
              <dt>Fecha de evaluación · UTC</dt>
              <dd>
                <time dateTime={record.created_at}>{displayDate(record.created_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Monto solicitado</dt>
              <dd>
                <span className="numeric">{record.amount}</span> {record.token}
              </dd>
            </div>
            <div>
              <dt>Agente evaluado</dt>
              <dd className="contract-address">{record.agent_id}</dd>
            </div>
            <div>
              <dt>Operación / red</dt>
              <dd>{record.operation} / {record.network}</dd>
            </div>
            <div className="ops-span-full">
              <dt>Destinatario / contrato destino</dt>
              <dd>
                <NearExplorerLink address={record.recipient} />
              </dd>
            </div>
            <div className="ops-span-full">
              <dt>Identificador de política</dt>
              <dd>
                <small className="contract-address numeric">{record.policy_id}</small>
              </dd>
            </div>
          </dl>

          {/* Asesor de Riesgo IA (Gemini) */}
          <AIAnalysisPanel analysis={record.ai_analysis} />

          <LivePolicy key={record.id || record.operation_id} policyId={record.policy_id} onNavigateToPolicy={onNavigateToPolicy} />

          <p className="ops-boundary-note">
            Esta evaluación comprueba exclusivamente las reglas de la política configurada en el servidor. La identidad del agente se autentica de forma segura mediante X-API-Key.
          </p>
        </>
      )}
      </AnimatedState>
    </Card>
  );
}

function LivePolicy({ policyId, onNavigateToPolicy }: { policyId: string; onNavigateToPolicy?: (id: string) => void }) {
  const notify = useToast();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const [currentPolicy, setCurrentPolicy] = useState<PolicyRecord | null>(null);
  const [fetchingPolicy, setFetchingPolicy] = useState(false);
  const [policyLookupError, setPolicyLookupError] = useState("");
  const [hasQueriedPolicy, setHasQueriedPolicy] = useState(false);

  async function checkLivePolicy() {
    if (fetchingPolicy) return;
    const controller = new AbortController();
    request.current = controller;
    setFetchingPolicy(true);
    setPolicyLookupError("");
    try {
      const live = await apiRequest<PolicyRecord>(`/policies/${encodeURIComponent(policyId)}`, { signal: controller.signal });
      if (!controller.signal.aborted) setCurrentPolicy(live);
      if (!controller.signal.aborted) notify({ title: 'Política verificada en el servidor', description: live.name, tone: 'success', key: 'live-policy' });
    } catch (err) {
      if (controller.signal.aborted) return;
      setPolicyLookupError(err instanceof Error ? err.message : "No se pudo consultar la política actual en el servidor.");
      notify({ title: 'No se pudo verificar la política', description: err instanceof Error ? err.message : 'Error de conexión con el servidor.', tone: 'error', key: 'live-policy' });
    } finally {
      if (!controller.signal.aborted) { setFetchingPolicy(false); setHasQueriedPolicy(true); }
    }
  }

  return (
    <div className="ops-live-policy-box">
      <div className="ops-live-policy-header">
        <span>Estado actual de la política en el servidor</span>
        {!currentPolicy && (
          <button
            type="button"
            className="link-text"
            onClick={checkLivePolicy}
            disabled={fetchingPolicy}
          >
            <RefreshCw size={13} />
            {fetchingPolicy ? "Consultando…" : hasQueriedPolicy ? "Reintentar consulta" : "Verificar política actual"}
          </button>
        )}
      </div>
      <AnimatedState stateKey={fetchingPolicy ? 'loading' : policyLookupError ? 'error' : currentPolicy ? 'ready' : 'idle'}>
        {fetchingPolicy && <p role="status" className="ops-field-help">Consultando política actual…</p>}
        {hasQueriedPolicy && currentPolicy && (
          <div className="ops-live-policy-content">
            <p>
              <strong>Política encontrada:</strong> {currentPolicy.name} ({currentPolicy.id.slice(-8)})
            </p>
            <small>
              Límite actual: <span className="numeric">{currentPolicy.max_amount}</span> · Tokens: {currentPolicy.allowed_tokens.join(", ")}
            </small>
            {onNavigateToPolicy && (
              <Button variant="secondary"
                type="button"
                className="ops-mt-sm"
                onClick={() => onNavigateToPolicy(currentPolicy.id)}
              >
                Abrir en pestaña Políticas →
              </Button>
            )}
          </div>
        )}
        {hasQueriedPolicy && policyLookupError && (
          <p className="ops-message error ops-mt-sm" role="alert">
            {policyLookupError}
          </p>
        )}
      </AnimatedState>
    </div>
  );
}
