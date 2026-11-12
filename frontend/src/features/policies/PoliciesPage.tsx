import AnimatedState from '../../components/ui/AnimatedState';
import { useToast } from '../../components/ui/ToastProvider';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CollapsibleBanner from '../../components/ui/CollapsibleBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { apiRequest } from "../../lib/api";
import PolicyCreator from "../operations/PolicyCreator";
import { copyToClipboard, displayDate } from "../operations/utils";
import type { PolicyRecord } from "../operations/types";
import "./policies.css";

interface Props {
  active: boolean;
  onEvaluateWithPolicy: (policyId: string) => void;
  onPolicyCreatedNotification?: (policy: PolicyRecord) => void;
  refreshSignal?: number;
}

export default function PoliciesPage({
  active,
  onEvaluateWithPolicy,
  onPolicyCreatedNotification,
  refreshSignal,
}: Props) {
  const notify = useToast();
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- Reset pending state when synchronizing with the policy API.
    setLoading(true);
    setError("");
    apiRequest<PolicyRecord[]>("/policies", { signal: controller.signal })
      .then((data) => {
        setPolicies(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las políticas.");
          notify({ title: 'No se pudieron cargar las políticas', description: err instanceof Error ? err.message : 'Error de conexión con el servidor.', tone: 'error', key: 'policies' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, localRefresh, refreshSignal, notify]);

  const filteredPolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchTokens = p.allowed_tokens.some((t) => t.toLowerCase().includes(q));
      const matchRecipients = p.allowed_recipients.some((r) => r.toLowerCase().includes(q));
      const matchOps = p.allowed_operations.some((o) => o.toLowerCase().includes(q));
      return matchName || matchId || matchTokens || matchRecipients || matchOps;
    });
  }, [policies, search]);

  const allTokens = useMemo(() => {
    const set = new Set<string>();
    for (const p of policies) {
      for (const t of p.allowed_tokens) set.add(t);
    }
    return Array.from(set);
  }, [policies]);

  function handlePolicyCreated(newPolicy: PolicyRecord) {
    setPolicies((prev) => [...prev.filter((p) => p.id !== newPolicy.id), newPolicy]);
    setCreating(false);
    setSelectedPolicy(newPolicy);
    setNotice(`Política "${newPolicy.name}" creada con éxito.`);
    onPolicyCreatedNotification?.(newPolicy);
  }

  async function handleCopy(id: string) {
    const success = await copyToClipboard(id);
    if (success) {
      setCopiedId(id);
      notify({ title: 'Identificador copiado', tone: 'success', key: 'copy-policy' });
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } else {
      notify({ title: 'No se pudo copiar el identificador', description: 'Selecciona el identificador y cópialo manualmente.', tone: 'error', key: 'copy-policy' });
    }
  }

  return (
    <div className="policies-page" hidden={!active}>
      <div className="section-heading">
        <h2>Políticas de seguridad</h2>
        <span className="demo-label">Reglas de autorización · Persistidas en el servidor</span>
      </div>

      <CollapsibleBanner
        id="policies-scope-info"
        title="Reglas directas de evaluación"
        tone="info"
        icon={<Info size={18} className="banner-main-icon" aria-hidden="true" />}
        ariaLabel="Información sobre el alcance de las políticas"
      >
        <p>
          En Sentinel, toda política registrada en el backend está lista para evaluarse de forma inmediata en las operaciones de agentes. El servidor no utiliza estados ficticios de activación o desactivación.
        </p>
      </CollapsibleBanner>

      <div className="policies-summary-grid" aria-label="Indicadores de políticas">
        <article className="metric-card policies-summary">
          <h3 className="metric-title">Políticas registradas</h3>
          <p className="metric-value numeric">{loading && !policies.length ? "—" : policies.length}</p>
          <small>Total almacenado en la base de datos</small>
        </article>
        <article className="metric-card policies-summary tokens">
          <h3 className="metric-title">Tokens gestionados</h3>
          <p className="metric-value numeric">{loading && !policies.length ? "—" : allTokens.length}</p>
          <small>{allTokens.length ? allTokens.join(", ") : "Ningún token registrado aún"}</small>
        </article>
      </div>

      {notice && (
        <p className="ops-message" role="status">
          {notice}
        </p>
      )}

      {creating && (
        <PolicyCreator
          onCreated={handlePolicyCreated}
          onClose={() => setCreating(false)}
          submitLabel="Crear política"
          title="Nueva política de seguridad"
        />
      )}

      <section className="card" aria-labelledby="policies-list-heading" aria-busy={loading}>
        <div className="card-header-row">
          <h3 id="policies-list-heading">
            <Lock size={18} aria-hidden="true" />
            Catálogo de políticas
          </h3>
          <div className="policies-actions">
            <Button variant="secondary"
              type="button"

              onClick={() => setLocalRefresh((v) => v + 1)}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Actualizar
            </Button>
            <Button variant="primary"
              type="button"

              onClick={() => setCreating(true)}
              disabled={creating || loading}
            >
              <Plus size={16} />
              Nueva política
            </Button>
          </div>
        </div>

        <div className="policies-toolbar">
          <div className="policies-search-box">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nombre, ID, token, operación o destinatario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar políticas en la lista local"
            />
          </div>
          {search && (
            <button
              type="button"
              className="link-text"
              onClick={() => setSearch("")}
            >
              Limpiar búsqueda ({filteredPolicies.length} {filteredPolicies.length === 1 ? "resultado" : "resultados"})
            </button>
          )}
        </div>

        <AnimatedState stateKey={loading ? 'loading' : error ? 'error' : !policies.length ? 'empty' : !filteredPolicies.length ? 'filtered-empty' : 'ready'}>
        {loading ? (
          <TableSkeleton label="Cargando políticas. Consultando el catálogo en el servidor…" columns={7} />
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
        ) : !policies.length ? (
          <div className="ops-empty">
            <Shield size={32} strokeWidth={1.25} />
            <h4>Aún no hay políticas registradas</h4>
            <p>Crea tu primera política para establecer límites de monto, tokens permitidos y destinatarios autorizados.</p>
            <Button variant="primary"
              type="button"

              onClick={() => setCreating(true)}
            >
              <Plus size={16} />
              Crear primera política
            </Button>
          </div>
        ) : !filteredPolicies.length ? (
          <div className="ops-empty">
            <Search size={28} />
            <h4>Sin coincidencias</h4>
            <p>No se encontraron políticas que coincidan con &ldquo;{search}&rdquo;.</p>
            <button
              type="button"
              className="link-text"
              onClick={() => setSearch("")}
            >
              Restablecer búsqueda
            </button>
          </div>
        ) : (
          <div
            className="policies-table-container"
            role="region"
            aria-label="Tabla de políticas registradas"
            tabIndex={0}
          >
            <table className="policies-table">
              <thead>
                <tr>
                  <th scope="col">Nombre e identificador</th>
                  <th scope="col">Monto máx.</th>
                  <th scope="col">Tokens</th>
                  <th scope="col">Operaciones</th>
                  <th scope="col">Destinatarios</th>
                  <th scope="col">Fecha creación · UTC</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((p) => {
                  const isCopied = copiedId === p.id;
                  const isSelected = selectedPolicy?.id === p.id;
                  return (
                    <tr key={p.id} aria-selected={isSelected}>
                      <td className="policy-name-cell">
                        <strong>{p.name}</strong>
                        <div className="policy-id-row">
                          <span className="policy-id-text contract-address numeric" title={p.id}>
                            {p.id.slice(0, 16)}…
                          </span>
                          <button
                            type="button"
                            className={`copy-mini-btn ${isCopied ? "copied" : ""}`}
                            onClick={() => handleCopy(p.id)}
                            aria-label={`Copiar ID completo de ${p.name}`}
                            title={isCopied ? "Copiado!" : "Copiar ID completo"}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="policy-amount-cell">
                        <strong className="numeric">{p.max_amount}</strong>
                        <small>Unidades de token</small>
                      </td>
                      <td>
                        <div className="policy-pills">
                          {p.allowed_tokens.map((token) => (
                            <span key={token} className="policy-pill token">
                              {token}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="policy-pills">
                          {p.allowed_operations.map((op) => (
                            <span key={op} className="policy-pill">
                              {op}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="policy-pills">
                          <span className="policy-pill" title={p.allowed_recipients.join(", ")}>
                            {p.allowed_recipients.length} {p.allowed_recipients.length === 1 ? "destinatario" : "destinatarios"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.created_at ? <time dateTime={p.created_at}>{displayDate(p.created_at)}</time> : <span>Activa</span>}
                      </td>
                      <td className="policy-actions-cell">
                        <div className="policy-actions-group">
                          <Button variant="secondary"
                            type="button"

                            onClick={() => setSelectedPolicy(p)}
                            aria-label={`Ver detalles de ${p.name}`}
                          >
                            Detalle
                          </Button>
                          <Button variant="primary"
                            type="button"

                            onClick={() => onEvaluateWithPolicy(p.id)}
                            title="Seleccionar esta política en la pestaña Operaciones"
                          >
                            Evaluar <ArrowRight size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedState>
      </section>

      {/* Policy Detail Modal */}
      {active && selectedPolicy && (
        <Modal labelledBy="policy-modal-title" onClose={() => setSelectedPolicy(null)}>
          <div
            className="card policy-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header-row">
              <h3 id="policy-modal-title">
                <Lock size={18} aria-hidden="true" />
                Detalle de política
              </h3>
              <button
                type="button"
                className="ops-icon-button"
                onClick={() => setSelectedPolicy(null)}
                aria-label="Cerrar detalle"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="ops-detail-grid">
              <div className="ops-span-full">
                <dt>Nombre de la política</dt>
                <dd>
                  <strong>{selectedPolicy.name}</strong>
                </dd>
              </div>
              <div className="ops-span-full">
                <dt>Identificador de política</dt>
                <dd className="policy-id-row">
                  <span className="contract-address numeric">{selectedPolicy.id}</span>
                  <button
                    type="button"
                    className={`copy-mini-btn ${copiedId === selectedPolicy.id ? "copied" : ""}`}
                    onClick={() => handleCopy(selectedPolicy.id)}
                    aria-label="Copiar ID completo"
                  >
                    {copiedId === selectedPolicy.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === selectedPolicy.id ? " Copiado!" : " Copiar ID"}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Fecha de registro · UTC</dt>
                <dd>
                  {selectedPolicy.created_at ? <time dateTime={selectedPolicy.created_at}>{displayDate(selectedPolicy.created_at)}</time> : <span>Activa</span>}
                </dd>
              </div>
              <div>
                <dt>Monto máximo por operación</dt>
                <dd>
                  <span className="numeric">{selectedPolicy.max_amount}</span>
                  <small>Expresado en unidades del token solicitado; sin conversión de divisas.</small>
                </dd>
              </div>
            </dl>

            <div className="policy-detail-section">
              <h4>Tokens permitidos ({selectedPolicy.allowed_tokens.length})</h4>
              <div className="policy-pills">
                {selectedPolicy.allowed_tokens.map((token) => (
                  <span key={token} className="policy-pill token">
                    {token}
                  </span>
                ))}
              </div>
            </div>

            <div className="policy-detail-section">
              <h4>Tipos de operación autorizados ({selectedPolicy.allowed_operations.length})</h4>
              <div className="policy-pills">
                {selectedPolicy.allowed_operations.map((op) => (
                  <span key={op} className="policy-pill">
                    {op}
                  </span>
                ))}
              </div>
            </div>

            <div className="policy-detail-section">
              <h4>Destinatarios y contratos autorizados ({selectedPolicy.allowed_recipients.length})</h4>
              <div className="policy-recipients-list">
                {selectedPolicy.allowed_recipients.map((rec) => (
                  <span key={rec} className="policy-recipient-item contract-address">
                    {rec}
                  </span>
                ))}
              </div>
            </div>

            <p className="ops-boundary-note">
              Esta política se evalúa en el backend cuando se envía una operación asociada a su identificador.
            </p>

            <div className="policy-detail-actions">
              <Button variant="secondary"
                type="button"

                onClick={() => setSelectedPolicy(null)}
              >
                Cerrar
              </Button>
              <Button variant="primary"
                type="button"

                onClick={() => {
                  const id = selectedPolicy.id;
                  setSelectedPolicy(null);
                  onEvaluateWithPolicy(id);
                }}
              >
                Evaluar con esta política <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
