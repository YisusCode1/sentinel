import { useState } from "react";
import { CheckCircle2, CircleSlash, RefreshCw, ShieldCheck, X, XCircle } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { displayDate } from "./utils";
import type { OperationRecord, PolicyRecord } from "./types";

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
  const [currentPolicy, setCurrentPolicy] = useState<PolicyRecord | null>(null);
  const [fetchingPolicy, setFetchingPolicy] = useState(false);
  const [policyLookupError, setPolicyLookupError] = useState("");
  const [hasQueriedPolicy, setHasQueriedPolicy] = useState(false);
  const [prevRecordId, setPrevRecordId] = useState(record?.operation_id);

  if (record?.operation_id !== prevRecordId) {
    setPrevRecordId(record?.operation_id);
    setCurrentPolicy(null);
    setPolicyLookupError("");
    setHasQueriedPolicy(false);
  }

  async function checkLivePolicy() {
    if (!record?.policy_id) return;
    setFetchingPolicy(true);
    setPolicyLookupError("");
    try {
      const live = await apiRequest<PolicyRecord>(`/policies/${encodeURIComponent(record.policy_id)}`);
      setCurrentPolicy(live);
    } catch (err) {
      setPolicyLookupError(err instanceof Error ? err.message : "No se pudo consultar la política actual en el servidor.");
    } finally {
      setFetchingPolicy(false);
      setHasQueriedPolicy(true);
    }
  }

  return (
    <section className="card ops-result" aria-labelledby="evaluation-result-title" aria-busy={pending}>
      <div className="card-header-row">
        <h3 id="evaluation-result-title">
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

      {pending ? (
        <div className="ops-empty" role="status">
          <span className="ops-loading-indicator" />
          <h4>Consultando evaluación</h4>
          <p>Esperando la respuesta del servidor…</p>
        </div>
      ) : error ? (
        <p className="ops-message error" role="alert">
          {error}
        </p>
      ) : !record ? (
        <div className="ops-empty">
          <ShieldCheck size={32} strokeWidth={1.25} />
          <h4>Listo para evaluar</h4>
          <p>Completa la operación o selecciona un registro del historial para consultar sus controles y resultado.</p>
        </div>
      ) : (
        <>
          <div className="ops-result-verdict" role="status">
            <DecisionBadge decision={record.decision} />
            <p>{record.reason}</p>
          </div>

          <dl className="ops-detail-grid">
            <div className="ops-span-full">
              <dt>Identificador de operación</dt>
              <dd className="contract-address numeric">{record.operation_id}</dd>
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
              <dt>Agente solicitante</dt>
              <dd className="contract-address">{record.agent_id}</dd>
            </div>
            <div>
              <dt>Operación / red</dt>
              <dd>{record.operation} / {record.network}</dd>
            </div>
            <div className="ops-span-full">
              <dt>Destinatario / contrato destino</dt>
              <dd className="contract-address">{record.recipient}</dd>
            </div>
            <div className="ops-span-full">
              <dt>Política aplicada</dt>
              <dd>
                <strong>{record.policy_name}</strong>
                <small className="contract-address numeric">{record.policy_id}</small>
              </dd>
            </div>
          </dl>

          <h4 className="ops-subheading">Controles de la política</h4>
          <ul className="ops-checks">
            {record.checks.map((check) => (
              <li key={check.code}>
                {check.passed ? (
                  <CheckCircle2 size={17} className="ops-pass" aria-hidden="true" />
                ) : (
                  <XCircle size={17} className="ops-fail" aria-hidden="true" />
                )}
                <div className="ops-check-body">
                  <div className="ops-check-header">
                    <strong>{check.label}</strong>
                    <span>{check.passed ? "Cumple" : "No cumple"}</span>
                  </div>
                  {check.detail && <small className="ops-check-detail">{check.detail}</small>}
                </div>
              </li>
            ))}
          </ul>

          <details className="ops-policy-snapshot" open>
            <summary>Copia histórica de la política al momento de la evaluación</summary>
            <p className="ops-field-help">Condiciones registradas de forma inmutable con la evaluación:</p>
            <dl className="ops-detail-grid">
              <div>
                <dt>Monto máximo por operación</dt>
                <dd className="numeric">{record.policy_snapshot.max_amount}</dd>
              </div>
              <div>
                <dt>Tokens autorizados</dt>
                <dd>{record.policy_snapshot.allowed_tokens.join(", ")}</dd>
              </div>
              <div>
                <dt>Tipos de operación</dt>
                <dd>{record.policy_snapshot.allowed_operations.join(", ")}</dd>
              </div>
              <div className="ops-span-full">
                <dt>Destinatarios autorizados</dt>
                <dd className="contract-address">{record.policy_snapshot.allowed_recipients.join(", ")}</dd>
              </div>
            </dl>
          </details>

          <div className="ops-live-policy-box">
            <div className="ops-live-policy-header">
              <span>Estado actual de la política en el servidor</span>
              {!hasQueriedPolicy && (
                <button
                  type="button"
                  className="link-text"
                  onClick={checkLivePolicy}
                  disabled={fetchingPolicy}
                >
                  <RefreshCw size={13} />
                  {fetchingPolicy ? "Consultando…" : "Verificar política actual"}
                </button>
              )}
            </div>
            {hasQueriedPolicy && currentPolicy && (
              <div className="ops-live-policy-content">
                <p>
                  <strong>Política encontrada:</strong> {currentPolicy.name} ({currentPolicy.id.slice(-8)})
                </p>
                <small>
                  Límite actual: <span className="numeric">{currentPolicy.max_amount}</span> · Tokens: {currentPolicy.allowed_tokens.join(", ")}
                </small>
                {onNavigateToPolicy && (
                  <button
                    type="button"
                    className="ops-secondary-button ops-mt-sm"
                    onClick={() => onNavigateToPolicy(currentPolicy.id)}
                  >
                    Abrir en pestaña Políticas →
                  </button>
                )}
              </div>
            )}
            {hasQueriedPolicy && policyLookupError && (
              <p className="ops-message error ops-mt-sm" role="alert">
                {policyLookupError}
              </p>
            )}
          </div>

          <div className="ops-analysis-note">
            <CircleSlash size={16} aria-hidden="true" />
            <div>
              <strong>Análisis de riesgo IA no disponible</strong>
              <p>Firma sin implementar · Verificación blockchain no realizada en esta versión.</p>
            </div>
          </div>
          <p className="ops-boundary-note">
            Esta evaluación comprueba exclusivamente las reglas de la política configurada. No envía ni bloquea transacciones en una billetera externa.
          </p>
        </>
      )}
    </section>
  );
}
