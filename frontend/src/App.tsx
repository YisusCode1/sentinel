import { useEffect, useState } from "react";
import {
  LayoutDashboard, Lock, Activity, AlertTriangle, FileText,
  Settings, Box, CheckCircle2, Key, Menu, X, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import OperationsPage from "./features/operations/OperationsPage";
import PoliciesPage from "./features/policies/PoliciesPage";
import AlertsPage from "./features/alerts/AlertsPage";
import ConfigPage from "./features/config/ConfigPage";
import { API_BASE_URL, apiRequest } from "./lib/api";
import type { OperationRecord, PolicyRecord } from "./features/operations/types";
import sentinelLogo from "./assets/sentinel-logo.png";
import "./App.css";

type Tab = "dashboard" | "operaciones" | "alerts" | "policies" | "reportes" | "configuracion";
const navigation: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "operaciones", label: "Operaciones", icon: Activity },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
  { id: "policies", label: "Políticas", icon: Lock },
  { id: "reportes", label: "Reportes", icon: FileText },
  { id: "configuracion", label: "Configuración", icon: Settings },
];

const demoMetrics = [
  { title: "Operaciones Analizadas", value: "12,480", change: "+12%", tone: "primary", icon: Box, direction: "up" },
  { title: "Operaciones Seguras", value: "11,920", change: "+15%", tone: "success", icon: CheckCircle2, direction: "up" },
  { title: "Alertas Críticas", value: "12", change: "−8%", tone: "critical", icon: AlertTriangle, direction: "down" },
  { title: "Políticas Activas", value: "5", change: "0%", tone: "neutral", icon: Key, direction: "flat" },
] as const;

const demoPolicies = [
  "Bloqueo de transacciones sospechosas",
  "Límites de monto por operación",
  "Detección de anomalías con IA",
  "Validación de contratos inteligentes",
];

function MetricCard({ title, value, change, tone, icon: Icon, direction }: (typeof demoMetrics)[number]) {
  const TrendIcon = direction === "down" ? ArrowDownRight : direction === "up" ? ArrowUpRight : Minus;
  return (
    <article className="metric-card" aria-label={title}>
      <div className="metric-heading">
        <h3 className="metric-title">{title}</h3>
        <Icon className={`metric-icon ${tone}`} size={19} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="metric-value numeric">{value}</p>
      <div className="metric-comparison">
        <span className={`metric-change ${direction === "flat" ? "neutral" : ""}`}>
          <TrendIcon size={14} aria-hidden="true" /><span className="numeric">{change}</span>
        </span>
        <span>vs. período anterior</span>
      </div>
    </article>
  );
}

function RecentAlerts() {
  return (
    <>
      <div className="alert-item critical">
        <div className="alert-row"><p><strong>Operación de alto riesgo detectada</strong></p><span className="badge-pill crit">Crítica</span></div>
        <small>Hace <span className="numeric">2</span> min · Riesgo: <span className="numeric">92%</span></small>
      </div>
      <div className="alert-item warning">
        <div className="alert-row"><p><strong>Patrón inusual en contratos</strong></p><span className="badge-pill warn">Advertencia</span></div>
        <small>Hace <span className="numeric">5</span> min · Riesgo: <span className="numeric">68%</span></small>
      </div>
      <div className="alert-item info">
        <div className="alert-row"><p><strong>Política actualizada</strong></p><span className="badge-pill inf">Info</span></div>
        <small>Hace <span className="numeric">10</span> min · Nueva regla de seguridad</small>
      </div>
    </>
  );
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Synchronization between features
  const [alertsCountState, setAlertsCountState] = useState<{
    count: number | null;
    loading: boolean;
    error: boolean;
  }>({ count: null, loading: true, error: false });
  const [alertsRefreshSignal, setAlertsRefreshSignal] = useState(0);
  const [policyRefreshSignal, setPolicyRefreshSignal] = useState(0);
  const [preselectedPolicyId, setPreselectedPolicyId] = useState<string | null>(null);

  const isOnline = backendStatus === "healthy";
  const connectionLabel = isOnline ? "Backend conectado" : backendStatus === "checking" ? "Verificando conexión" : "Backend sin conexión";
  const connectionClass = isOnline ? "online" : backendStatus === "checking" ? "" : "offline";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    fetch(`${API_BASE_URL}/api/v1/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Health check failed");
        return response.json();
      })
      .then((data) => { if (active) setBackendStatus(data.status); })
      .catch(() => { if (active) setBackendStatus("disconnected"); })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setCheckedAt(new Date());
      });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, []);

  // Update navigation alerts count: query GET /operations?decision=rejected&page_size=1
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ total: number }>("/operations?decision=rejected&page_size=1", {
      signal: controller.signal,
    })
      .then((data) => {
        setAlertsCountState({ count: data.total, loading: false, error: false });
      })
      .catch((_err) => {
        if (!controller.signal.aborted) {
          setAlertsCountState((prev) => ({ ...prev, loading: false, error: true }));
        }
      });
    return () => controller.abort();
  }, [alertsRefreshSignal, backendStatus]);

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleEvaluateWithPolicy = (policyId: string) => {
    setPreselectedPolicyId(policyId);
    setActiveTab("operaciones");
    setIsMobileMenuOpen(false);
  };

  const handleNavigateToPolicy = (_policyId: string) => {
    setActiveTab("policies");
    setIsMobileMenuOpen(false);
  };

  const handleOperationEvaluated = (_record: OperationRecord) => {
    setAlertsRefreshSignal((s) => s + 1);
  };

  const handlePolicyCreated = (_policy: PolicyRecord) => {
    setPolicyRefreshSignal((s) => s + 1);
  };

  // Close mobile navigation on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <div className="sentinel-container">
      {/* Mobile top bar with logo, connection status and drawer trigger */}
      <header className="mobile-top-bar" aria-label="Cabecera móvil">
        <div className="mobile-brand">
          <div className="logo-icon mobile-logo-icon">
            <img src={sentinelLogo} alt="Logo de Sentinel" className="logo-img" width={28} height={28} />
          </div>
          <div className="mobile-title-group">
            <h2 className="mobile-brand-title">Sentinel</h2>
            <span className="subtitle">Blockchain Intelligence</span>
          </div>
        </div>
        <div className="mobile-top-actions">
          <span className={`dot ${connectionClass}`} title={connectionLabel} aria-label={connectionLabel} />
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="main-navigation"
            aria-label={isMobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          >
            {isMobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            <span>{isMobileMenuOpen ? "Cerrar" : "Menú"}</span>
          </button>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside id="main-navigation" className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div>
          <div className="logo-area">
            <div className="logo-icon">
              <img src={sentinelLogo} alt="Logo de Sentinel" className="logo-img" width={34} height={34} />
            </div>
            <div><h3>Sentinel</h3><span className="subtitle">Blockchain Intelligence</span></div>
            <button
              type="button"
              className="sidebar-mobile-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Cerrar navegación"
            >
              <X size={18} />
            </button>
          </div>
          <p className="nav-section-label">Centro de control</p>
          <nav className="nav-menu" aria-label="Navegación principal">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-btn ${activeTab === id ? "active" : ""}`}
                onClick={() => handleNavClick(id)}
                aria-current={activeTab === id ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {label}
                {id === "alerts" && (
                  <span
                    className={`badge-count numeric ${alertsCountState.error ? "badge-error" : ""}`}
                    aria-label={
                      alertsCountState.error
                        ? "Error al consultar alertas"
                        : alertsCountState.loading && alertsCountState.count === null
                        ? "Consultando alertas…"
                        : `${alertsCountState.count ?? 0} evaluaciones rechazadas`
                    }
                    title={
                      alertsCountState.error
                        ? "No se pudo consultar el contador en el servidor"
                        : `${alertsCountState.count ?? 0} evaluaciones rechazadas por política`
                    }
                  >
                    {alertsCountState.error
                      ? "?"
                      : alertsCountState.loading && alertsCountState.count === null
                      ? "…"
                      : (alertsCountState.count ?? 0).toLocaleString("en-US")}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="system-indicator">
            <span className={`dot ${connectionClass}`} aria-hidden="true" />
            <div>
              <p className="status-text" role="status">{connectionLabel}</p>
              {checkedAt && <small>Última comprobación<time dateTime={checkedAt.toISOString()}>{new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(checkedAt)} UTC</time></small>}
            </div>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <div className="welcome-box">
            <p className="eyebrow">Inteligencia y control de riesgo</p>
            <h1>{activeTab === "dashboard" ? "Resumen de operaciones" : navigation.find((item) => item.id === activeTab)?.label}</h1>
            <p>Análisis y supervisión de seguridad para operaciones blockchain.</p>
          </div>
          <div className="user-profile">
            <span className="connection-badge"><span className={`dot ${connectionClass}`} aria-hidden="true" />{connectionLabel}</span>
            <div className="avatar" aria-label="Perfil JD">JD</div>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <>
            <div className="section-heading"><h2 id="metrics-heading">Indicadores de supervisión</h2><span className="demo-label">Vista de demostración · Datos ilustrativos</span></div>
            <section className="metrics-grid" aria-labelledby="metrics-heading">
              {demoMetrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
            </section>
            <div className="grid-split">
              <section className="card" aria-labelledby="activity-heading">
                <div className="chart-header-flex"><h3 id="activity-heading">Actividad reciente</h3><span className="demo-label">Muestra de actividad · UTC</span></div>
                <div className="chart-legend"><span><i className="legend-line" />Total</span><span><i className="legend-line risk" />Riesgo</span></div>
                <div className="chart-wrapper">
                  <div className="y-axis-labels numeric" aria-hidden="true"><span>1,000</span><span>750</span><span>500</span><span>250</span><span>0</span></div>
                  <svg className="svg-chart" viewBox="0 0 500 120" preserveAspectRatio="none" role="img" aria-label="Actividad ilustrativa entre las 04:00 y las 05:00 UTC: el total aumenta y la actividad de riesgo se mantiene por debajo.">
                    {[0, 30, 60, 90, 120].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} className="chart-grid" />)}
                    <path d="M 0,65 Q 50,75 100,50 T 200,45 T 300,55 T 400,30 T 500,35 L 500,120 L 0,120 Z" fill="var(--azul-marca)" fillOpacity="0.08" />
                    <path d="M 0,90 Q 60,85 120,95 T 240,88 T 360,92 T 440,85 T 500,90" fill="none" stroke="var(--amarillo-alerta)" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                    <path d="M 0,65 Q 50,75 100,50 T 200,45 T 300,55 T 400,30 T 500,35" fill="none" stroke="var(--azul-marca)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
                <div className="chart-axis-labels numeric"><span>04:00</span><span>04:15</span><span>04:30</span><span>04:45</span><span>05:00</span></div>
              </section>
              <section className="card" aria-labelledby="system-heading">
                <div className="card-header-row"><h3 id="system-heading">Estado del sistema</h3><Activity size={17} aria-hidden="true" /></div>
                <div className="availability"><div><p className="numeric">99.9%</p><p className="availability-label">Disponibilidad ilustrativa</p></div><span className="badge-pill inf">Demo</span></div>
                <ul className="service-list">
                  <li><span>Backend FastAPI</span><strong className={connectionClass}>{isOnline ? "Conectado" : backendStatus === "checking" ? "Verificando" : "Sin conexión"}</strong></li>
                  {["Base de datos", "Conexión NEAR", "Gemini AI"].map((service) => <li key={service}><span>{service}</span><strong>Sin verificar</strong></li>)}
                </ul>
              </section>
            </div>
            <div className="grid-split">
              <section className="card" aria-labelledby="policies-heading">
                <div className="card-header-row"><h3 id="policies-heading"><Lock size={17} aria-hidden="true" />Políticas de seguridad</h3><button className="link-text" onClick={() => handleNavClick("policies")}>Ver todas →</button></div>
                <p className="demo-label">Controles de demostración · Cambios locales</p>
                <ul className="policy-list-mini">
                  {demoPolicies.map((name) => <li key={name}><span>{name}</span><label className="switch"><input type="checkbox" defaultChecked aria-label={name} /><span className="slider" /></label></li>)}
                </ul>
              </section>
              <section className="card" aria-labelledby="alerts-heading">
                <div className="card-header-row"><h3 id="alerts-heading"><AlertTriangle size={17} aria-hidden="true" />Últimas alertas</h3><button className="link-text" onClick={() => handleNavClick("alerts")}>Ver todas →</button></div>
                <RecentAlerts />
              </section>
            </div>
          </>
        )}

        <OperationsPage
          active={activeTab === "operaciones"}
          preselectedPolicyId={preselectedPolicyId}
          onClearPreselectedPolicy={() => setPreselectedPolicyId(null)}
          onOperationEvaluated={handleOperationEvaluated}
          onPolicyCreated={handlePolicyCreated}
          onNavigateToPolicy={handleNavigateToPolicy}
          policyRefreshSignal={policyRefreshSignal}
        />

        <PoliciesPage
          active={activeTab === "policies"}
          onEvaluateWithPolicy={handleEvaluateWithPolicy}
          onPolicyCreatedNotification={handlePolicyCreated}
          refreshSignal={policyRefreshSignal}
        />

        <AlertsPage
          active={activeTab === "alerts"}
          onNavigateToPolicy={handleNavigateToPolicy}
          refreshSignal={alertsRefreshSignal}
        />

        <ConfigPage
          active={activeTab === "configuracion"}
          backendOnline={isOnline}
        />

        {activeTab === "reportes" && (
          <section className="card empty-state">
            <h3><FileText size={18} />Reportes de seguridad</h3>
            <p>Esta sección aún no dispone de datos consolidados. Puedes consultar el centro de alertas o el historial de operaciones.</p>
            <button className="link-text" onClick={() => handleNavClick("dashboard")}>Volver al dashboard →</button>
          </section>
        )}
      </main>
    </div>
  );
}
