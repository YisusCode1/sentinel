import AnimatedState from '../../components/ui/AnimatedState';
import { useToast } from '../../components/ui/ToastProvider';
import Button from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Download, Filter, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest } from "../../lib/api";
import OperationResult, { DecisionBadge, NearExplorerLink } from "./OperationResult";
import PolicyCreator from "./PolicyCreator";
import { amountPattern, displayDate, isPositiveAmount, operationsCsv } from "./utils";
import type { OperationDecision, OperationFilters, OperationInput, OperationPage as Page, OperationRecord, PolicyRecord } from "./types";
import "./operations.css";

const emptyFilters: OperationFilters = { q: "", decision: "", date_from: "", date_to: "" };
const initialInput: OperationInput = { policy_id: "", network: "near-testnet", operation: "transfer", token: "USDC", amount: "", recipient: "" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la solicitud.";

const demoPresets = [
  {
    id: "legit",
    title: "1. Operación Legítima",
    tone: "success" as const,
    subtitle: "Dentro de límites · Destinatario seguro",
    values: {
      operation: "transfer",
      token: "USDC",
      amount: "25.00",
      recipient: "tesoreria.testnet",
    },
  },
  {
    id: "limit",
    title: "2. Exceso de Límite",
    tone: "danger" as const,
    subtitle: "Supera el monto máximo de la política",
    values: {
      operation: "transfer",
      token: "USDC",
      amount: "5000.00",
      recipient: "tesoreria.testnet",
    },
  },
  {
    id: "phishing",
    title: "3. Destinatario Sospechoso",
    tone: "danger" as const,
    subtitle: "Cuenta no registrada en lista blanca",
    values: {
      operation: "transfer",
      token: "USDC",
      amount: "15.00",
      recipient: "drainer-vault.testnet",
    },
  },
  {
    id: "unauthorized_op",
    title: "4. Operación Prohibida",
    tone: "warning" as const,
    subtitle: "Tipo de transacción no permitida",
    values: {
      operation: "stake_unauthorized",
      token: "USDC",
      amount: "10.00",
      recipient: "tesoreria.testnet",
    },
  },
];

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
  const notify = useToast();
  const [input, setInput] = useState<OperationInput>(initialInput);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState("");
  const [policyRefresh, setPolicyRefresh] = useState(0);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [formError, setFormError] = useState("");
  const [evaluationError, setEvaluationError] = useState("");
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
  const [activePreset, setActivePreset] = useState<string | null>(null);
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
      .catch((error) => { if (!controller.signal.aborted) { setPoliciesError(errorMessage(error)); notify({ title: 'No se pudieron cargar las políticas', description: errorMessage(error), tone: 'error', key: 'operation-policies' }); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingPolicies(false); });
    return () => controller.abort();
  }, [active, policyRefresh, policyRefreshSignal, notify]);

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

    const endpoint = filters.decision ? `/operations?decision=${encodeURIComponent(filters.decision)}&limit=200` : `/operations?limit=200`;
    apiRequest<OperationRecord[]>(endpoint, { signal: controller.signal })
      .then((rawList) => {
        const list = Array.isArray(rawList) ? rawList : [];
        const q = filters.q.trim().toLowerCase();
        const filtered = list.filter((item) => {
          if (q) {
            const matchesId = (item.id || item.operation_id || "").toLowerCase().includes(q);
            const matchesAgent = (item.agent_id || "").toLowerCase().includes(q);
            const matchesRecipient = (item.recipient || "").toLowerCase().includes(q);
            const matchesToken = (item.token || "").toLowerCase().includes(q);
            const matchesOp = (item.operation || "").toLowerCase().includes(q);
            if (!matchesId && !matchesAgent && !matchesRecipient && !matchesToken && !matchesOp) return false;
          }
          if (filters.date_from) {
            const itemDate = item.created_at.slice(0, 10);
            if (itemDate < filters.date_from) return false;
          }
          if (filters.date_to) {
            const itemDate = item.created_at.slice(0, 10);
            if (itemDate > filters.date_to) return false;
          }
          return true;
        });

        const total = filtered.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

        const approvedCount = list.filter((item) => item.decision === "approved").length;
        const rejectedCount = list.filter((item) => item.decision === "rejected").length;

        setData({
          items: paginatedItems,
          total,
          page,
          page_size: pageSize,
          summary: {
            total: list.length,
            approved: approvedCount,
            rejected: rejectedCount,
          },
        });
      })
      .catch((error) => { if (!controller.signal.aborted) { setHistoryError(errorMessage(error)); notify({ title: 'No se pudo cargar el historial', description: errorMessage(error), tone: 'error', key: 'history' }); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingHistory(false); });
    return () => controller.abort();
  }, [active, filters, page, pageSize, historyRefresh, notify]);

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

  async function createDemoPolicy() {
    setLoadingPolicies(true);
    try {
      const demoPolicy = await apiRequest<PolicyRecord>("/policies", {
        method: "POST",
        body: JSON.stringify({
          name: "Tesorería Corporativa NEAR",
          max_amount: "100.00",
          allowed_tokens: ["USDC", "USDT", "NEAR"],
          allowed_recipients: ["tesoreria.testnet", "proveedor-autorizado.testnet"],
          allowed_operations: ["transfer", "swap"],
        }),
      });
      policyCreated(demoPolicy);
      notify({
        title: "Política demo creada",
        description: "Tesorería Corporativa NEAR lista para evaluación",
        tone: "success",
      });
    } catch (err) {
      notify({
        title: "Error al crear política demo",
        description: errorMessage(err),
        tone: "error",
      });
    } finally {
      setLoadingPolicies(false);
    }
  }

  function loadPreset(preset: typeof demoPresets[number]) {
    const targetPolicy = selectedPolicy || policies[0];
    if (targetPolicy && !selectedPolicy) {
      selectPolicy(targetPolicy);
    }
    const token = targetPolicy?.allowed_tokens.includes(preset.values.token)
      ? preset.values.token
      : (targetPolicy?.allowed_tokens[0] || preset.values.token);

    setInput((prev) => ({
      ...prev,
      policy_id: targetPolicy?.id || prev.policy_id,
      operation: preset.values.operation,
      token,
      amount: preset.values.amount,
      recipient: preset.values.recipient,
    }));
    setActivePreset(preset.id);
    setNotice(`Escenario demo cargado: "${preset.title}". Haz clic en "Evaluar operación" para ver el pipeline en acción.`);
    notify({
      title: "Escenario demo cargado",
      description: preset.title,
      tone: "info",
    });
  }

  async function evaluate(event: React.FormEvent) {
    event.preventDefault();
    if (evaluating) return;
    const payload: OperationInput = {
      policy_id: input.policy_id,
      network: input.network,
      operation: input.operation.trim(),
      token: input.token.trim(),
      amount: input.amount.trim(),
      recipient: input.recipient.trim(),
    };
    if (!selectedPolicy || !payload.operation || !payload.token || !payload.recipient || !isPositiveAmount(payload.amount)) {
      setFormError("Selecciona una política y completa todos los campos con un monto mayor que cero. Usa punto decimal, sin separadores de miles.");
      return;
    }
    const body = JSON.stringify(payload);
    detailRequest.current?.abort();
    setDetailPending(false);
    setDetailError("");
    setFormError("");
    setEvaluationError("");
    setNotice("");
    setResult(null);
    setEvaluating(true);
    try {
      const decision = await apiRequest<OperationDecision>("/operations/evaluate", {
        method: "POST",
        body,
      });

      // Obtener el registro completo persistido por el backend
      let fullRecord: OperationRecord;
      try {
        fullRecord = await apiRequest<OperationRecord>(`/operations/${encodeURIComponent(decision.operation_id)}`);
      } catch {
        fullRecord = {
          id: decision.operation_id,
          operation_id: decision.operation_id,
          agent_id: "Agente autenticado",
          policy_id: decision.policy_id,
          network: payload.network,
          operation: payload.operation,
          token: payload.token,
          amount: payload.amount,
          recipient: payload.recipient,
          decision: decision.decision,
          reason: decision.reason,
          created_at: new Date().toISOString(),
          ai_analysis: decision.ai_analysis,
        };
      }

      setResult(fullRecord);
      setNotice("Evaluación registrada. El Policy Engine determinó la autorización de la operación.");
      setPage(1);
      setHistoryRefresh((previous) => previous + 1);
      onOperationEvaluated?.(fullRecord);
    } catch (error) { setEvaluationError(errorMessage(error)); notify({ title: 'No se pudo evaluar la operación', description: errorMessage(error), tone: 'error', key: 'evaluation-error' }); }
    finally { setEvaluating(false); }
  }

  async function openDetail(id: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailPending(true);
    setDetailError("");
    setEvaluationError("");
    setResult(null);
    resultRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    resultRef.current?.focus({ preventScroll: true });
    try { setResult(await apiRequest<OperationRecord>(`/operations/${encodeURIComponent(id)}`, { signal: controller.signal })); }
    catch (error) { if (!controller.signal.aborted) { setDetailError(errorMessage(error)); notify({ title: 'No se pudo cargar el detalle', description: errorMessage(error), tone: 'error', key: 'operation-detail' }); } }
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
    notify({ title: 'CSV generado', description: `${data.items.length} registros de la página ${data.page}.`, tone: 'success', key: 'operations-export' });
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
          <p className="ops-muted">Comprueba la operación contra las condiciones de una política. La autenticación del agente se resuelve por X-API-Key.</p>

          {/* SIMULADOR DE ESCENARIOS DE DEMOSTRACIÓN (1-CLICK PARA JURADOS) */}
          <div className="ops-demo-presets">
            <div className="ops-demo-presets-header">
              <span className="ops-demo-presets-title">
                <Sparkles size={14} className="text-cyan-400" />
                Simulador de Escenarios Demo (1 Clic)
              </span>
              <span className="ops-demo-presets-subtitle">Carga casos de prueba en tiempo real para el jurado</span>
            </div>
            <div className="ops-demo-presets-grid">
              {demoPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`ops-preset-btn ${activePreset === preset.id ? "active" : ""}`}
                  onClick={() => loadPreset(preset)}
                >
                  <span className={`ops-preset-tag ${preset.tone}`}>
                    <Play size={11} />
                    {preset.title}
                  </span>
                  <span className="ops-preset-desc">{preset.subtitle}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={evaluate}>
            <fieldset className="ops-form-grid" disabled={evaluating}>
              <div className="ops-span-full">
                <div className="ops-field-toolbar">
                  <label htmlFor="operation-policy">Política de seguridad</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {!policies.length && !loadingPolicies && (
                      <button type="button" className="link-text" onClick={createDemoPolicy} disabled={loadingPolicies}>
                        <Sparkles size={13} /> Crear política demo
                      </button>
                    )}
                    <button type="button" className="link-text" onClick={() => setCreatingPolicy(true)} disabled={creatingPolicy || loadingPolicies}>
                      <Plus size={14} /> Nueva política
                    </button>
                  </div>
                </div>
                <select id="operation-policy" required className="ops-control" value={input.policy_id} onChange={(e) => selectPolicy(policies.find((policy) => policy.id === e.target.value))} disabled={loadingPolicies}>
                  <option value="">{loadingPolicies ? "Cargando políticas…" : "Selecciona una política"}</option>
                  {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {policy.id.slice(-8)}</option>)}
                </select>
                {policiesError && <div className="ops-message error" role="alert">{policiesError}<button type="button" className="link-text" onClick={() => setPolicyRefresh((previous) => previous + 1)}>Reintentar carga</button></div>}
                {!loadingPolicies && !policiesError && !policies.length && (
                  <p className="ops-field-help">
                    Todavía no hay políticas. Haz clic en <strong>Crear política demo</strong> para configurar una instantáneamente.
                  </p>
                )}
                {selectedPolicy && <div className="ops-policy-context"><span>Límite por operación <strong className="numeric">{selectedPolicy.max_amount}</strong></span><span>Tokens: {selectedPolicy.allowed_tokens.join(", ")}</span></div>}
              </div>
              <label className="ops-field">
                Red
                <select value={input.network} onChange={(e) => updateInput("network", e.target.value)}>
                  <option value="near-testnet">NEAR Protocol Testnet</option>
                </select>
              </label>
              <label className="ops-field">Tipo de operación<input required maxLength={256} list="operation-types" value={input.operation} onChange={(e) => updateInput("operation", e.target.value)} /><datalist id="operation-types">{[...new Set(["transfer", "swap", "stake", ...(selectedPolicy?.allowed_operations ?? [])])].map((type) => <option key={type} value={type} />)}</datalist></label>
              <label className="ops-field">Token<input required maxLength={256} list="operation-tokens" value={input.token} onChange={(e) => updateInput("token", e.target.value)} /><datalist id="operation-tokens">{selectedPolicy?.allowed_tokens.map((token) => <option key={token} value={token} />)}</datalist></label>
              <label className="ops-field ops-span-full">Monto<input required inputMode="decimal" pattern={amountPattern} maxLength={55} placeholder="0.00" title="Monto positivo, hasta 30 dígitos enteros y 24 decimales, usando punto decimal" value={input.amount} onChange={(e) => updateInput("amount", e.target.value)} /><small>En unidades del token. Usa punto decimal, sin separadores de miles.</small></label>
              <label className="ops-field ops-span-full">
                Destinatario / contrato
                <input required className="contract-address" maxLength={256} placeholder="tesoreria.testnet" value={input.recipient} onChange={(e) => updateInput("recipient", e.target.value)} />
                <small>Ej: tesoreria.testnet o cuenta NEAR válida</small>
              </label>
            </fieldset>
            {formError && <p className="ops-message error" role="alert">{formError}</p>}
            <div className="ops-form-actions"><Button variant="secondary" type="button" disabled={evaluating} onClick={() => { setInput(initialInput); setFormError(""); setActivePreset(null); }}>Limpiar</Button><Button variant="primary" type="submit" loading={evaluating} loadingLabel="Evaluando…" disabled={loadingPolicies || !selectedPolicy}><ShieldCheck size={17} aria-hidden="true" />Evaluar operación</Button></div>
          </form>
        </section>
        <div ref={resultRef} tabIndex={-1} className="ops-result-anchor">
          <OperationResult
            record={result}
            pending={evaluating || detailPending}
            error={detailError || evaluationError}
            onNavigateToPolicy={onNavigateToPolicy}
          />
        </div>
      </div>
      <section className="card ops-history" aria-labelledby="history-title" aria-busy={loadingHistory}>
        <div className="card-header-row"><h3 id="history-title">Historial de evaluaciones</h3><div className="ops-toolbar"><Button variant="secondary" type="button" disabled={loadingHistory} onClick={() => setHistoryRefresh((previous) => previous + 1)}><RefreshCw size={15} />Actualizar</Button><Button variant="secondary" type="button" onClick={exportPage} disabled={!data?.items.length || loadingHistory}><Download size={15} />Exportar página CSV</Button></div></div>
        <form className="ops-filters" onSubmit={applyFilters}>
          <label className="ops-field ops-search">Buscar<div className="ops-search-input"><Search size={16} aria-hidden="true" /><input maxLength={256} placeholder="ID, agente, destinatario o token" value={draftFilters.q} onChange={(e) => setDraftFilters({ ...draftFilters, q: e.target.value })} /></div></label>
          <label className="ops-field">Decisión<select value={draftFilters.decision} onChange={(e) => setDraftFilters({ ...draftFilters, decision: e.target.value as OperationFilters['decision'] })}><option value="">Todas</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option></select></label>
          <label className="ops-field">Desde · UTC<input type="date" className="numeric" value={draftFilters.date_from} max={draftFilters.date_to || undefined} onChange={(e) => setDraftFilters({ ...draftFilters, date_from: e.target.value })} /></label>
          <label className="ops-field">Hasta · UTC<input type="date" className="numeric" value={draftFilters.date_to} min={draftFilters.date_from || undefined} onChange={(e) => setDraftFilters({ ...draftFilters, date_to: e.target.value })} /></label>
          <Button variant="secondary"  type="submit"><Filter size={15} />Aplicar filtros</Button>
          <button className="link-text" type="button" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setFilterError(""); setPage(1); }}>Restablecer</button>
        </form>
        {filterError && <p className="ops-message error" role="alert">{filterError}</p>}
        <AnimatedState stateKey={loadingHistory ? 'loading' : historyError ? 'error' : data?.items.length ? 'ready' : 'empty'}>
        {loadingHistory ? <TableSkeleton label="Cargando historial de evaluaciones…" columns={6} /> : historyError ? <div className="ops-message error" role="alert"><p>{historyError}</p><button type="button" className="link-text" onClick={() => setHistoryRefresh((previous) => previous + 1)}>Reintentar</button></div> : !data?.items.length ? <div className="ops-empty"><Activity size={28} /><h4>{Object.values(filters).some(Boolean) ? "No hay resultados con estos filtros" : "Aún no hay evaluaciones"}</h4><p>{Object.values(filters).some(Boolean) ? "Ajusta la búsqueda o restablece los filtros." : "Evalúa tu primera operación para iniciar el historial."}</p></div> : (
          <div className="ops-table-scroll" role="region" aria-label="Tabla de evaluaciones; desplázate horizontalmente para ver todas las columnas" tabIndex={0}>
            <table className="ops-table"><caption className="ops-sr-only">Evaluaciones registradas en el servidor. Fechas en UTC.</caption><thead><tr><th scope="col">Operación / agente</th><th scope="col">Fecha · UTC</th><th scope="col">Monto</th><th scope="col">Destinatario</th><th scope="col">Decisión</th><th scope="col">Detalle</th></tr></thead>
              <tbody>{data.items.map((record) => {
                const recId = record.id || record.operation_id || "";
                return (
                  <tr key={recId} aria-selected={(result?.id || result?.operation_id) === recId}>
                    <td><span className="ops-table-id numeric" title={recId}>{recId.slice(0, 11)}…</span><small className="contract-address">{record.agent_id}</small></td>
                    <td><time dateTime={record.created_at}>{displayDate(record.created_at)}</time></td>
                    <td className="ops-amount-cell"><strong className="numeric">{record.amount}</strong><small>{record.token} · {record.operation}</small></td>
                    <td className="ops-recipient">
                      <NearExplorerLink address={record.recipient} />
                      <small>{record.network}</small>
                    </td>
                    <td><DecisionBadge decision={record.decision} /></td>
                    <td><button type="button" className="ops-icon-button" onClick={() => openDetail(recId)} disabled={evaluating} aria-label={`Ver detalle de ${recId}`}><ArrowRight size={18} /></button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </AnimatedState>
        {data && <div className="ops-pagination"><span><span className="numeric">{data.total}</span> resultados · Página <span className="numeric">{page}</span> de <span className="numeric">{pages}</span></span><div className="ops-pagination-controls"><label>Filas<select className="numeric" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50].map((size) => <option value={size} key={size}>{size}</option>)}</select></label><button type="button" className="ops-icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button type="button" className="ops-icon-button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div>}
      </section>
    </div>
  );
}
