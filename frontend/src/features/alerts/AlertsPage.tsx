import AnimatedState from '../../components/ui/AnimatedState';
import { useToast } from '../../components/ui/ToastProvider';
import Button from '../../components/ui/Button';
import CollapsibleBanner from '../../components/ui/CollapsibleBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { apiRequest } from "../../lib/api";
import OperationResult, { DecisionBadge, NearExplorerLink } from "../operations/OperationResult";
import { displayDate, operationsCsv } from "../operations/utils";
import type { OperationPage, OperationRecord } from "../operations/types";
import "./alerts.css";

interface Filters {
  q: string;
  date_from: string;
  date_to: string;
}

const emptyFilters: Filters = { q: "", date_from: "", date_to: "" };
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "No se pudo consultar el servidor de alertas.";

interface Props {
  active: boolean;
  onNavigateToPolicy?: (policyId: string) => void;
  refreshSignal?: number;
}

export default function AlertsPage({ active, onNavigateToPolicy, refreshSignal }: Props) {
  const notify = useToast();
  const [data, setData] = useState<OperationPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);

  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedRecord, setSelectedRecord] = useState<OperationRecord | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");

  const detailRequest = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- Reset pending and invalidate previous data when query changes.
    setLoading(true);
    setError("");
    setData(null);

    const endpoint = `/operations?decision=rejected&limit=200`;
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

        setData({
          items: paginatedItems,
          total,
          page,
          page_size: pageSize,
          summary: {
            total: list.length,
            approved: 0,
            rejected: list.length,
          },
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err));
          notify({ title: 'No se pudieron cargar las alertas', description: errorMessage(err), tone: 'error', key: 'alerts' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [active, filters, page, pageSize, localRefresh, refreshSignal, notify]);

  useEffect(() => () => detailRequest.current?.abort(), []);

  async function openDetail(id: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailPending(true);
    setDetailError("");
    setSelectedRecord(null);

    detailRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    detailRef.current?.focus({ preventScroll: true });

    try {
      const record = await apiRequest<OperationRecord>(`/operations/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });
      setSelectedRecord(record);
    } catch (err) {
      if (!controller.signal.aborted) {
        setDetailError(errorMessage(err));
        notify({ title: 'No se pudo cargar el detalle', description: errorMessage(err), tone: 'error', key: 'alert-detail' });
      }
    } finally {
      if (!controller.signal.aborted) setDetailPending(false);
    }
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

  function resetFilters() {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setFilterError("");
    setPage(1);
  }

  function exportVisibleCsv() {
    if (!data?.items.length) return;
    const csv = operationsCsv(data.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel-alertas-pagina-${data.page}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Se exportó la página ${data.page} con ${data.items.length} registros de alertas rechazadas.`);
    notify({ title: 'CSV de alertas generado', description: `${data.items.length} registros de la página ${data.page}.`, tone: 'success', key: 'alerts-export' });
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="alerts-page" hidden={!active}>
      <div className="section-heading">
        <h2>Centro de alertas</h2>
        <span className="demo-label">Evaluaciones rechazadas por política · Servidor</span>
      </div>

      <CollapsibleBanner
        id="alerts-rejected-info"
        title="Rechazos por política de seguridad"
        tone="warning"
        icon={<AlertTriangle size={18} className="banner-main-icon" aria-hidden="true" />}
        ariaLabel="Aviso institucional sobre rechazos de política"
      >
        <p>
          Esta vista reúne todas las solicitudes que no cumplieron las condiciones definidas en su respectiva política. Las decisiones de rechazo son determinadas exclusivamente por el Policy Engine autoritativo del backend.
        </p>
      </CollapsibleBanner>

      <div className="alerts-summary-grid" aria-label="Indicadores de alertas rechazadas">
        <article className="metric-card alerts-summary rejected">
          <h3 className="metric-title">Alertas rechazadas</h3>
          <p className="metric-value numeric">
            {data ? data.summary.rejected.toLocaleString("en-US") : "—"}
          </p>
          <small>Según los filtros aplicados en el servidor</small>
        </article>
        <article className="metric-card alerts-summary page">
          <h3 className="metric-title">Registros visibles</h3>
          <p className="metric-value numeric">
            {data ? `${data.items.length} / ${data.total}` : "—"}
          </p>
          <small>Página {page} de {pages}</small>
        </article>
        <article className="metric-card alerts-summary system">
          <h3 className="metric-title">Asesor de riesgo IA</h3>
          <div className="metric-value" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.2rem" }}>
            <ShieldAlert size={20} style={{ color: "var(--azul-marca, #06b6d4)" }} aria-hidden="true" />
            <span>Gemini AI</span>
          </div>
          <small>Asesor preventivo de riesgo · Política autoritativa</small>
        </article>
      </div>

      {notice && (
        <p className="ops-message" role="status">
          {notice}
        </p>
      )}

      {/* Detail panel if an alert is selected */}
      {(selectedRecord || detailPending || detailError) && (
        <div ref={detailRef} tabIndex={-1} className="alert-detail-container ops-result-anchor">
          <OperationResult
            record={selectedRecord}
            pending={detailPending}
            error={detailError}
            onNavigateToPolicy={onNavigateToPolicy}
            onClose={() => {
              setSelectedRecord(null);
              setDetailError("");
            }}
          />
        </div>
      )}

      <section className="card" aria-labelledby="alerts-table-heading" aria-busy={loading}>
        <div className="card-header-row">
          <h3 id="alerts-table-heading">
            <ShieldAlert size={18} aria-hidden="true" />
            Historial de operaciones rechazadas
          </h3>
          <div className="ops-toolbar">
            <Button variant="secondary"
              type="button"
              onClick={() => setLocalRefresh((v) => v + 1)}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Actualizar
            </Button>
            <Button variant="secondary"
              type="button"
              onClick={exportVisibleCsv}
              disabled={loading || !data?.items.length}
              title="Descarga un archivo CSV con las alertas visibles en esta página"
            >
              <Download size={14} />
              Exportar página visible CSV
            </Button>
          </div>
        </div>

        <form className="ops-filters" onSubmit={applyFilters}>
          <label className="ops-field ops-search">
            Buscar alertas
            <div className="ops-search-input">
              <Search size={16} aria-hidden="true" />
              <input
                maxLength={256}
                placeholder="ID, agente, destinatario o token…"
                value={draftFilters.q}
                onChange={(e) => setDraftFilters({ ...draftFilters, q: e.target.value })}
              />
            </div>
          </label>
          <label className="ops-field">
            Desde · UTC
            <input
              type="date"
              className="numeric"
              value={draftFilters.date_from}
              max={draftFilters.date_to || undefined}
              onChange={(e) => setDraftFilters({ ...draftFilters, date_from: e.target.value })}
            />
          </label>
          <label className="ops-field">
            Hasta · UTC
            <input
              type="date"
              className="numeric"
              value={draftFilters.date_to}
              min={draftFilters.date_from || undefined}
              onChange={(e) => setDraftFilters({ ...draftFilters, date_to: e.target.value })}
            />
          </label>
          <Button variant="secondary"  type="submit" disabled={loading}>
            <Filter size={15} />
            Aplicar filtros
          </Button>
          <button className="link-text" type="button" onClick={resetFilters}>
            Restablecer
          </button>
        </form>

        {filterError && (
          <p className="ops-message error" role="alert">
            {filterError}
          </p>
        )}

        <AnimatedState stateKey={loading ? 'loading' : error ? 'error' : data?.items.length ? 'ready' : 'empty'}>
        {loading ? (
          <TableSkeleton label="Cargando alertas. Consultando operaciones rechazadas en el backend…" columns={6} />
        ) : error ? (
          <div className="ops-message error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="link-text"
              onClick={() => setLocalRefresh((v) => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="ops-empty">
            <ShieldAlert size={28} />
            <h4>
              {Object.values(filters).some(Boolean)
                ? "Sin alertas con los filtros actuales"
                : "No hay alertas rechazadas"}
            </h4>
            <p>
              {Object.values(filters).some(Boolean)
                ? "Ajusta la búsqueda o restablece las fechas para encontrar más registros."
                : "Las operaciones evaluadas que incumplan una política aparecerán automáticamente aquí."}
            </p>
          </div>
        ) : (
          <div
            className="ops-table-scroll"
            role="region"
            aria-label="Tabla de operaciones rechazadas por política"
            tabIndex={0}
          >
            <table className="ops-table">
              <caption className="ops-sr-only">
                Operaciones rechazadas registradas en el backend. Fechas en formato UTC.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Operación / agente</th>
                  <th scope="col">Fecha · UTC</th>
                  <th scope="col">Monto solicitado</th>
                  <th scope="col">Destinatario</th>
                  <th scope="col">Motivo de rechazo</th>
                  <th scope="col">Riesgo IA</th>
                  <th scope="col">Decisión</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((record) => {
                  const recId = record.id || record.operation_id || "";
                  const isSelected = (selectedRecord?.id || selectedRecord?.operation_id) === recId;
                  return (
                    <tr key={recId} aria-selected={isSelected}>
                      <td>
                        <span className="ops-table-id numeric" title={recId}>
                          {recId.slice(0, 12)}…
                        </span>
                        <small className="contract-address">{record.agent_id}</small>
                      </td>
                      <td>
                        <time dateTime={record.created_at}>{displayDate(record.created_at)}</time>
                      </td>
                      <td className="ops-amount-cell">
                        <strong className="numeric">{record.amount}</strong>
                        <small>{record.token} · {record.operation}</small>
                      </td>
                      <td className="ops-recipient">
                        <NearExplorerLink address={record.recipient} />
                        <small>{record.network}</small>
                      </td>
                      <td>
                        <p className="alert-reason-text" style={{ margin: 0, fontWeight: 500 }}>{record.reason}</p>
                        <small className="contract-address" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Política: {record.policy_id.slice(-8)}</small>
                      </td>
                      <td>
                        {record.ai_analysis && record.ai_analysis.risk_level !== "unknown" ? (
                          <span className={`badge-pill ${record.ai_analysis.risk_level === "low" ? "succ" : record.ai_analysis.risk_level === "medium" ? "warn" : "crit"}`}>
                            {record.ai_analysis.risk_score}/100
                          </span>
                        ) : (
                          <span className="badge-pill inf">N/A</span>
                        )}
                      </td>
                      <td>
                        <DecisionBadge decision={record.decision} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ops-icon-button"
                          onClick={() => openDetail(recId)}
                          aria-label={`Ver detalle completo de alerta ${recId}`}
                        >
                          <ArrowRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedState>

        {data && (
          <div className="ops-pagination">
            <span>
              <span className="numeric">{data.total}</span> alertas · Página{" "}
              <span className="numeric">{page}</span> de <span className="numeric">{pages}</span>
            </span>
            <div className="ops-pagination-controls">
              <label>
                Filas
                <select
                  className="numeric"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 25, 50].map((size) => (
                    <option value={size} key={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ops-icon-button"
                aria-label="Página anterior de alertas"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="ops-icon-button"
                aria-label="Página siguiente de alertas"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
