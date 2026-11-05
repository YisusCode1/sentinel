import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Download, Filter, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { apiRequest } from "../../lib/api";
import OperationResult, { DecisionBadge } from "./OperationResult";
import PolicyCreator from "./PolicyCreator";
import { amountPattern, displayDate, isPositiveAmount, operationQuery, operationsCsv } from "./utils";
import type { OperationFilters, OperationInput, OperationPage as Page, OperationRecord, PolicyRecord } from "./types";
import "./operations.css";

const emptyFilters: OperationFilters = { q: "", decision: "", date_from: "", date_to: "" };
const initialInput: OperationInput = { agent_id: "", policy_id: "", network: "near-testnet", operation: "transfer", token: "USDC", amount: "", recipient: "" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la solicitud.";

interface OperationsPageProps {
  active: boolean;
  preselectedPolicyId?: string | null;
  onClearPreselectedPolicy?: () => void;
  onOperationEvaluated?: (record: OperationRecord) => void;
  onPolicyCreated?: (policy: PolicyRecord) => void;
  onNavigateToPolicy?: (policyId: string) => void;
  policyRefreshSignal?: number;
}

export default function OperationsPage({
  active,
  preselectedPolicyId,
  onClearPreselectedPolicy,
  onOperationEvaluated,
  onPolicyCreated,
  onNavigateToPolicy,
  policyRefreshSignal,
}: OperationsPageProps) {
  const [input, setInput] = useState<OperationInput>(initialInput);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState("");
  const [policyRefresh, setPolicyRefresh] = useState(0);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [formError, setFormError] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<OperationRecord | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [data, setData] = useState<Page | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [draftFilters, setDraftFilters] = useState<OperationFilters>(emptyFilters);
  const [filters, setFilters] = useState<OperationFilters>(emptyFilters);
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notice, setNotice] = useState("");
  const submission = useRef<{ body: string; key: string; completed: boolean } | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const selectedPolicy = policies.find((policy) => policy.id === input.policy_id);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- Reset pending state when synchronizing with the policy API.
    setLoadingPolicies(true);
    setPoliciesError("");
    apiRequest<PolicyRecord[]>("/policies", { signal: controller.signal })
      .then(setPolicies)
      .catch((error) => { if (!controller.signal.aborted) setPoliciesError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingPolicies(false); });
    return () => controller.abort();
  }, [active, policyRefresh, policyRefreshSignal]);

  useEffect(() => {
    if (!preselectedPolicyId || !policies.length) return;
    const targetPolicy = policies.find((p) => p.id === preselectedPolicyId);
    if (targetPolicy) {
      // oxlint-disable-next-line react/set-state-in-effect -- Synchronize form fields when preselecting a policy from another tab.
      selectPolicy(targetPolicy);
      // oxlint-disable-next-line react/set-state-in-effect -- Inform the user that the policy has been preselected.
      setNotice(`Política "${targetPolicy.name}" seleccionada para evaluación.`);
      onClearPreselectedPolicy?.();
    }
  }, [preselectedPolicyId, policies, onClearPreselectedPolicy]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- A new server query invalidates the previously displayed page.
    setLoadingHistory(true);
    setHistoryError("");
    setData(null);
    apiRequest<Page>(`/operations?${operationQuery(filters, page, pageSize)}`, { signal: controller.signal })
      .then(setData)
      .catch((error) => { if (!controller.signal.aborted) setHistoryError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingHistory(false); });
    return () => controller.abort();
  }, [active, filters, page, pageSize, historyRefresh]);

  useEffect(() => () => detailRequest.current?.abort(), []);

  function selectPolicy(policy: PolicyRecord | undefined) {
    setInput((previous) => ({ ...previous, policy_id: policy?.id ?? "", token: policy?.allowed_tokens[0] ?? previous.token, operation: policy?.allowed_operations[0] ?? previous.operation, recipient: policy?.allowed_recipients[0] ?? previous.recipient }));
  }

  function policyCreated(policy: PolicyRecord) {
    setPolicies((previous) => [...previous.filter((item) => item.id !== policy.id), policy]);
    setPoliciesError("");
    selectPolicy(policy);
    setCreatingPolicy(false);
    setNotice("Política creada y seleccionada. Completa los datos para evaluar la operación.");
    onPolicyCreated?.(policy);
  }

  async function evaluate(event: React.FormEvent) {
    event.preventDefault();
    if (evaluating) return;
    const payload: OperationInput = { ...input, agent_id: input.agent_id.trim(), operation: input.operation.trim(), token: input.token.trim(), amount: input.amount.trim(), recipient: input.recipient.trim() };
    if (!selectedPolicy || !payload.agent_id || !payload.operation || !payload.token || !payload.recipient || !isPositiveAmount(payload.amount)) {
      setFormError("Selecciona una política y completa todos los campos con un monto mayor que cero. Usa punto decimal, sin separadores de miles.");
      return;
    }
    const body = JSON.stringify(payload);
    // Reuse the key when retrying the same submission after a lost response.
    if (!submission.current || submission.current.body !== body || submission.current.completed) {
      submission.current = { body, key: crypto.randomUUID(), completed: false };
    }
    detailRequest.current?.abort();
    setDetailPending(false);
    setDetailError("");
    setFormError("");
    setNotice("");
    setResult(null);
    setEvaluating(true);
    try {
      const record = await apiRequest<OperationRecord>("/operations/evaluate", { method: "POST", body, headers: { "Idempotency-Key": submission.current.key } });
      submission.current.completed = true;
      setResult(record);
      setNotice("Evaluación registrada. El resultado corresponde a los datos enviados; el historial mantiene los filtros actuales.");
      setPage(1);
      setHistoryRefresh((previous) => previous + 1);
      onOperationEvaluated?.(record);
    } catch (error) { setFormError(errorMessage(error)); }
    finally { setEvaluating(false); }
  }

  async function openDetail(id: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailPending(true);
    setDetailError("");
    setResult(null);
    resultRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    resultRef.current?.focus({ preventScroll: true });
    try { setResult(await apiRequest<OperationRecord>(`/operations/${encodeURIComponent(id)}`, { signal: controller.signal })); }
    catch (error) { if (!controller.signal.aborted) setDetailError(errorMessage(error)); }
    finally { if (!controller.signal.aborted) setDetailPending(false); }
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if (draftFilters.date_from && draftFilters.date_to && draftFilters.date_from > draftFilters.date_to) {
      setFilterError("La fecha inicial debe ser anterior o igual a la final.");
      return;
    }
    setFilterError("");
    setPage(1);
    setFilters({ ...draftFilters });
  }

  function exportPage() {
    if (!data?.items.length) return;
    const url = URL.createObjectURL(new Blob([operationsCsv(data.items)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel-operaciones-pagina-${data.page}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Se exportó la página ${data.page} con ${data.items.length} registros.`);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const updateInput = (field: keyof OperationInput, value: string) => setInput((previous) => ({ ...previous, [field]: value }));
  return (
    <div className="operations-page" hidden={!active}>
      <div className="section-heading"><h2>Control de operaciones</h2><span className="demo-label">Evaluaciones persistidas · NEAR Testnet</span></div>
      <div className="ops-summary-grid" aria-label="Resumen del historial filtrado">
        {([['Evaluaciones', data?.summary.total, 'total'], ['Aprobadas por política', data?.summary.approved, 'approved'], ['Rechazadas por política', data?.summary.rejected, 'rejected']] as const).map(([label, value, tone]) => (
          <article className={`metric-card ops-summary ${tone}`} key={label}><h3 className="metric-title">{label}</h3><p className="metric-value numeric">{value === undefined ? '—' : value.toLocaleString('en-US')}</p><small>Según los filtros del historial</small></article>
        ))}
      </div>
      {notice && <p className="ops-message" role="status">{notice}</p>}
      {creatingPolicy && (
        <PolicyCreator
          onCreated={policyCreated}
          onClose={() => setCreatingPolicy(false)}
          submitLabel="Crear y seleccionar política"
          title="Nueva política"
        />
      )}
      <div className="ops-workspace">
        <section className="card" aria-labelledby="operation-form-title">
          <div className="card-header-row"><h3 id="operation-form-title"><Activity size={18} />Evaluar operación</h3><span className="ops-step">Control previo</span></div>
          <p className="ops-muted">Comprueba la operación contra las condiciones de una política.</p>
          <form onSubmit={evaluate}>
            <fieldset className="ops-form-grid" disabled={evaluating}>
              <div className="ops-span-full">
                <div className="ops-field-toolbar"><label htmlFor="operation-policy">Política de seguridad</label><button type="button" className="link-text" onClick={() => setCreatingPolicy(true)} disabled={creatingPolicy || loadingPolicies}><Plus size={14} /> Nueva política</button></div>
                <select id="operation-policy" required className="ops-control" value={input.policy_id} onChange={(e) => selectPolicy(policies.find((policy) => policy.id === e.target.value))} disabled={loadingPolicies}>
                  <option value="">{loadingPolicies ? "Cargando políticas…" : "Selecciona una política"}</option>
                  {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {policy.id.slice(-8)}</option>)}
                </select>
                {policiesError && <div className="ops-message error" role="alert">{policiesError}<button type="button" className="link-text" onClick={() => setPolicyRefresh((previous) => previous + 1)}>Reintentar carga</button></div>}
                {!loadingPolicies && !policiesError && !policies.length && <p className="ops-field-help">Todavía no hay políticas. Crea una para comenzar.</p>}
                {selectedPolicy && <div className="ops-policy-context"><span>Límite por operación <strong className="numeric">{selectedPolicy.max_amount}</strong></span><span>Tokens: {selectedPolicy.allowed_tokens.join(", ")}</span></div>}
              </div>
              <label className="ops-field">Agente<input required className="contract-address" maxLength={256} placeholder="sentinel-agent" value={input.agent_id} onChange={(e) => updateInput("agent_id", e.target.value)} /></label>
              <label className="ops-field">Red<select value={input.network} onChange={(e) => updateInput("network", e.target.value)}><option value="near-testnet">NEAR Testnet</option></select></label>
              <label className="ops-field">Tipo de operación<input required maxLength={256} list="operation-types" value={input.operation} onChange={(e) => updateInput("operation", e.target.value)} /><datalist id="operation-types">{[...new Set(["transfer", "swap", "stake", ...(selectedPolicy?.allowed_operations ?? [])])].map((type) => <option key={type} value={type} />)}</datalist></label>
              <label className="ops-field">Token<input required maxLength={256} list="operation-tokens" value={input.token} onChange={(e) => updateInput("token", e.target.value)} /><datalist id="operation-tokens">{selectedPolicy?.allowed_tokens.map((token) => <option key={token} value={token} />)}</datalist></label>
              <label className="ops-field ops-span-full">Monto<input required inputMode="decimal" pattern={amountPattern} maxLength={55} placeholder="0.00" title="Monto positivo, hasta 30 dígitos enteros y 24 decimales, usando punto decimal" value={input.amount} onChange={(e) => updateInput("amount", e.target.value)} /><small>En unidades del token. Usa punto decimal, sin separadores de miles.</small></label>
              <label className="ops-field ops-span-full">Destinatario / contrato<input required className="contract-address" maxLength={256} placeholder="tesoreria.testnet" value={input.recipient} onChange={(e) => updateInput("recipient", e.target.value)} /></label>
            </fieldset>
            {formError && <p className="ops-message error" role="alert">{formError}</p>}
            <div className="ops-form-actions"><button type="button" className="ops-secondary-button" disabled={evaluating} onClick={() => { setInput(initialInput); setFormError(""); }}>Limpiar</button><button className="action-btn" disabled={evaluating || loadingPolicies || !selectedPolicy}><ShieldCheck size={17} />{evaluating ? "Evaluando…" : "Evaluar operación"}</button></div>
          </form>
        </section>
        <div ref={resultRef} tabIndex={-1} className="ops-result-anchor">
          <OperationResult
            record={result}
            pending={evaluating || detailPending}
            error={detailError}
            onNavigateToPolicy={onNavigateToPolicy}
          />
        </div>
      </div>
      <section className="card ops-history" aria-labelledby="history-title" aria-busy={loadingHistory}>
        <div className="card-header-row"><h3 id="history-title">Historial de evaluaciones</h3><div className="ops-toolbar"><button type="button" className="ops-secondary-button" disabled={loadingHistory} onClick={() => setHistoryRefresh((previous) => previous + 1)}><RefreshCw size={15} />Actualizar</button><button type="button" className="ops-secondary-button" onClick={exportPage} disabled={!data?.items.length || loadingHistory}><Download size={15} />Exportar página CSV</button></div></div>
        <form className="ops-filters" onSubmit={applyFilters}>
          <label className="ops-field ops-search">Buscar<div className="ops-search-input"><Search size={16} aria-hidden="true" /><input maxLength={256} placeholder="ID, agente, destinatario o token" value={draftFilters.q} onChange={(e) => setDraftFilters({ ...draftFilters, q: e.target.value })} /></div></label>
          <label className="ops-field">Decisión<select value={draftFilters.decision} onChange={(e) => setDraftFilters({ ...draftFilters, decision: e.target.value as OperationFilters['decision'] })}><option value="">Todas</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option></select></label>
          <label className="ops-field">Desde · UTC<input type="date" className="numeric" value={draftFilters.date_from} max={draftFilters.date_to || undefined} onChange={(e) => setDraftFilters({ ...draftFilters, date_from: e.target.value })} /></label>
          <label className="ops-field">Hasta · UTC<input type="date" className="numeric" value={draftFilters.date_to} min={draftFilters.date_from || undefined} onChange={(e) => setDraftFilters({ ...draftFilters, date_to: e.target.value })} /></label>
          <button className="ops-secondary-button" type="submit"><Filter size={15} />Aplicar filtros</button>
          <button className="link-text" type="button" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setFilterError(""); setPage(1); }}>Restablecer</button>
        </form>
        {filterError && <p className="ops-message error" role="alert">{filterError}</p>}
        {loadingHistory ? <div className="ops-empty" role="status">Cargando historial…</div> : historyError ? <div className="ops-message error" role="alert"><p>{historyError}</p><button type="button" className="link-text" onClick={() => setHistoryRefresh((previous) => previous + 1)}>Reintentar</button></div> : !data?.items.length ? <div className="ops-empty"><Activity size={28} /><h4>{Object.values(filters).some(Boolean) ? "No hay resultados con estos filtros" : "Aún no hay evaluaciones"}</h4><p>{Object.values(filters).some(Boolean) ? "Ajusta la búsqueda o restablece los filtros." : "Evalúa tu primera operación para iniciar el historial."}</p></div> : (
          <div className="ops-table-scroll" role="region" aria-label="Tabla de evaluaciones; desplázate horizontalmente para ver todas las columnas" tabIndex={0}>
            <table className="ops-table"><caption className="ops-sr-only">Evaluaciones registradas en el servidor. Fechas en UTC.</caption><thead><tr><th scope="col">Operación / agente</th><th scope="col">Fecha · UTC</th><th scope="col">Monto</th><th scope="col">Destinatario</th><th scope="col">Decisión</th><th scope="col">Detalle</th></tr></thead>
              <tbody>{data.items.map((record) => <tr key={record.operation_id} aria-selected={result?.operation_id === record.operation_id}><td><span className="ops-table-id numeric" title={record.operation_id}>{record.operation_id.slice(0, 11)}…</span><small className="contract-address">{record.agent_id}</small></td><td><time dateTime={record.created_at}>{displayDate(record.created_at)}</time></td><td className="ops-amount-cell"><strong className="numeric">{record.amount}</strong><small>{record.token} · {record.operation}</small></td><td className="ops-recipient"><span className="contract-address">{record.recipient}</span><small>{record.network}</small></td><td><DecisionBadge decision={record.decision} /></td><td><button type="button" className="ops-icon-button" onClick={() => openDetail(record.operation_id)} disabled={evaluating} aria-label={`Ver detalle de ${record.operation_id}`}><ArrowRight size={18} /></button></td></tr>)}</tbody>
            </table>
          </div>
        )}
        {data && <div className="ops-pagination"><span><span className="numeric">{data.total}</span> resultados · Página <span className="numeric">{page}</span> de <span className="numeric">{pages}</span></span><div className="ops-pagination-controls"><label>Filas<select className="numeric" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50].map((size) => <option value={size} key={size}>{size}</option>)}</select></label><button type="button" className="ops-icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button type="button" className="ops-icon-button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div>}
      </section>
    </div>
  );
}
