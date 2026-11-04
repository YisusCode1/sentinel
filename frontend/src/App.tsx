import { useEffect, useState } from "react";
import { 
  Shield, 
  LayoutDashboard, 
  Lock, 
  Activity, 
  AlertTriangle, 
  FileText, 
  Settings, 
  Box, 
  CheckCircle2, 
  Key,
  Menu,
  X 
} from "lucide-react";
import "./App.css";

interface Policy {
  name: string;
  max_amount: string;
  allowed_tokens: string[];
  allowed_recipients: string[];
  allowed_operations: string[];
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fecha y hora dinámica automática al cargar la página
  const [currentDate] = useState(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes} UTC`;
  });

  const [policyForm, setPolicyForm] = useState<Policy>({
    name: "Demo transfer policy",
    max_amount: "100",
    allowed_tokens: ["USDC"],
    allowed_recipients: ["demo-recipient"],
    allowed_operations: ["transfer"],
  });

  const [policyResponse, setPolicyResponse] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8001/api/v1/health")
      .then((response) => response.json())
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("Disconnected"));
  }, []);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8001/api/v1/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      const data = await res.json();
      setPolicyResponse(JSON.stringify(data, null, 2));
    } catch {
      setPolicyResponse(
        JSON.stringify({ error: "No se pudo conectar con el backend" }, null, 2)
      );
    }
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="sentinel-container">
      {/* Botón de Menú Hamburguesa para Móvil */}
      <button 
        className="mobile-menu-btn" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle Menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar de Navegación */}
      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div>
          <div className="logo-area">
            <div className="logo-img-container">
              <img src="/src/assets/logo.jpeg" alt="Sentinel Logo" className="sidebar-logo" />
            </div>
            <div>
              <h3>Sentinel</h3>
              <span className="subtitle">AI Blockchain Security</span>
            </div>
          </div>
          <nav className="nav-menu">
            <button
              className={activeTab === "dashboard" ? "nav-btn active" : "nav-btn"}
              onClick={() => handleNavClick("dashboard")}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button
              className={activeTab === "operaciones" ? "nav-btn active" : "nav-btn"}
              onClick={() => handleNavClick("operaciones")}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg> 
              Operaciones
            </button>
            <button
              className={activeTab === "alerts" ? "nav-btn active" : "nav-btn"}
              onClick={() => handleNavClick("alerts")}
            >
              <AlertTriangle size={18} /> Alertas <span className="badge-count">3</span>
            </button>
            <button
              className={activeTab === "reportes" ? "nav-btn active" : "nav-btn"}
              onClick={() => handleNavClick("reportes")}
            >
              <FileText size={18} /> Reportes
            </button>
            <button
              className={activeTab === "configuracion" ? "nav-btn active" : "nav-btn"}
              onClick={() => handleNavClick("configuracion")}
            >
              <Settings size={18} /> Configuración
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="system-indicator">
            <span className={`dot ${backendStatus === "healthy" ? "online" : "offline"}`}></span>
            <div>
              <p className="status-text">Sistema Online</p>
              <small>Última actualización:<br />{currentDate}</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="main-content">
        <header className="top-header">
          <div className="welcome-box">
            <h1>Bienvenido a Sentinel</h1>
            <p>Protección inteligente para tus operaciones en Web3</p>
          </div>
          <div className="user-profile">
            <span className="online-badge">● Conectado</span>
            <div className="avatar">JD</div>
            <span className="dropdown-arrow">▼</span>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <>
            {/* Tarjetas de Métricas Superiores */}
            <section className="metrics-grid">
              <div className="metric-card card-blue">
                <div className="metric-content">
                  <span className="metric-title">Operaciones Analizadas</span>
                  <div className="metric-row">
                    <h2>12,480</h2>
                    <span className="trend-up">↑ +12%</span>
                  </div>
                </div>
                <div className="metric-right-section">
                  <div className="metric-icon-box blue"><Box size={20} /></div>
                  <svg className="mini-sparkline" viewBox="0 0 70 25">
                    <path d="M 0,20 Q 20,15 35,10 T 70,5" fill="none" stroke="#06b6d4" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="metric-card card-green">
                <div className="metric-content">
                  <span className="metric-title">Operaciones Seguras</span>
                  <div className="metric-row">
                    <h2>11,920</h2>
                    <span className="trend-up">↑ +15%</span>
                  </div>
                </div>
                <div className="metric-right-section">
                  <div className="metric-icon-box green"><CheckCircle2 size={20} /></div>
                  <svg className="mini-sparkline" viewBox="0 0 70 25">
                    <path d="M 0,22 Q 25,18 45,8 T 70,3" fill="none" stroke="#10b981" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="metric-card card-red">
                <div className="metric-content">
                  <span className="metric-title">Alertas Críticas</span>
                  <div className="metric-row">
                    <h2>12</h2>
                    <span className="trend-down">↓ -8%</span>
                  </div>
                </div>
                <div className="metric-right-section">
                  <div className="metric-icon-box red"><AlertTriangle size={20} /></div>
                  <svg className="mini-sparkline" viewBox="0 0 70 25">
                    <path d="M 0,5 Q 25,18 50,10 T 70,20" fill="none" stroke="#ef4444" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="metric-card card-purple">
                <div className="metric-content">
                  <span className="metric-title">Políticas Activas</span>
                  <div className="metric-row">
                    <h2>5</h2>
                    <span className="trend-neutral">↑ +0%</span>
                  </div>
                </div>
                <div className="metric-right-section">
                  <div className="metric-icon-box purple"><Key size={20} /></div>
                  <svg className="mini-sparkline" viewBox="0 0 70 25">
                    <path d="M 0,15 Q 20,20 40,8 T 70,5" fill="none" stroke="#a855f7" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </section>

            {/* Gráfico y Estado del Sistema */}
            <div className="grid-split">
              <div className="card">
                <div className="chart-header-flex">
                  <h3>Actividad Reciente</h3>
                  <div className="realtime-badge">
                    <span className="dot online"></span> En tiempo real
                  </div>
                </div>
                <div className="chart-legend">
                  <span><span className="dot-total">●</span> Total</span>
                  <span><span className="dot-risk">●</span> Riesgo</span>
                </div>

                <div className="chart-wrapper">
                  <div className="y-axis-labels">
                    <span>1,000</span>
                    <span>750</span>
                    <span>500</span>
                    <span>250</span>
                    <span>0</span>
                  </div>
                  <svg className="svg-chart" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="logoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0,65 Q 50,75 100,50 T 200,45 T 300,55 T 400,30 T 500,35 L 500,120 L 0,120 Z"
                      fill="url(#logoGradient)"
                    />
                    <path
                      d="M 0,90 Q 60,85 120,95 T 240,88 T 360,92 T 440,85 T 500,90"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 0,65 Q 50,75 100,50 T 200,45 T 300,55 T 400,30 T 500,35"
                      fill="none"
                      stroke="url(#lineGrad)"
                      strokeWidth="3"
                    />
                  </svg>
                </div>

                <div className="chart-axis-labels">
                  <span>04:00</span>
                  <span>04:15</span>
                  <span>04:30</span>
                  <span>04:45</span>
                  <span>05:00</span>
                </div>
              </div>

              <div className="card">
                <div className="card-header-row" style={{ borderBottom: '1px solid var(--borde-sutil)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3>Estado del Sistema</h3>
                </div>
                <div className="gauge-container">
                  <div className="gauge-circle">
                    <h2>99.9%</h2>
                    <span>Operativo</span>
                  </div>
                </div>
                <ul className="service-list">
                  <li><span>Backend FastAPI</span> <strong className="online">Online</strong></li>
                  <li><span>Base de Datos</span> <strong className="online">Online</strong></li>
                  <li><span>Conexión NEAR</span> <strong className="online">Online</strong></li>
                  <li><span>Gemini AI</span> <strong className="online">Online</strong></li>
                </ul>
              </div>
            </div>

            {/* Políticas y Alertas */}
            <div className="grid-split">
              <div className="card">
                <div className="card-header-row">
                  <h3>🔒 Políticas de Seguridad</h3>
                  <span className="link-text" onClick={() => setActiveTab("policies")}>Ver todas →</span>
                </div>
                <ul className="policy-list-mini">
                  <li>
                    <span>Bloqueo de transacciones sospechosas</span>
                    <label className="switch"><input type="checkbox" defaultChecked /><span className="slider"></span></label>
                  </li>
                  <li>
                    <span>Límites de monto por operación</span>
                    <label className="switch"><input type="checkbox" defaultChecked /><span className="slider"></span></label>
                  </li>
                  <li>
                    <span>Detección de anomalías con IA</span>
                    <label className="switch"><input type="checkbox" defaultChecked /><span className="slider"></span></label>
                  </li>
                  <li>
                    <span>Validación de contratos inteligentes</span>
                    <label className="switch"><input type="checkbox" defaultChecked /><span className="slider"></span></label>
                  </li>
                </ul>
              </div>

              <div className="card">
                <div className="card-header-row">
                  <h3>⚠️ Últimas Alertas</h3>
                  <span className="link-text" onClick={() => setActiveTab("alerts")}>Ver todas →</span>
                </div>
                <div className="alert-item critical">
                  <div className="alert-row">
                    <p><strong>Operación de alto riesgo detectada</strong></p>
                    <span className="badge-pill crit">Crítica</span>
                  </div>
                  <small>Hace 2 min • Riesgo: 92%</small>
                </div>
                <div className="alert-item warning">
                  <div className="alert-row">
                    <p><strong>Patrón inusual en contratos</strong></p>
                    <span className="badge-pill warn">Advertencia</span>
                  </div>
                  <small>Hace 5 min • Riesgo: 68%</small>
                </div>
                <div className="alert-item info">
                  <div className="alert-row">
                    <p><strong>Política actualizada</strong></p>
                    <span className="badge-pill inf">Info</span>
                  </div>
                  <small>Hace 10 min • Nueva regla de seguridad</small>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "policies" && (
          <section className="card">
            <h3>⚙️ Configuración y Creación de Políticas (API Backend)</h3>
            <form onSubmit={handleCreatePolicy} className="policy-form">
              <label>
                Nombre de la Política:
                <input 
                  type="text" 
                  value={policyForm.name} 
                  onChange={(e) => setPolicyForm({...policyForm, name: e.target.value})} 
                />
              </label>
              <label>
                Monto Máximo (max_amount):
                <input 
                  type="text" 
                  value={policyForm.max_amount} 
                  onChange={(e) => setPolicyForm({...policyForm, max_amount: e.target.value})} 
                />
              </label>
              <button type="submit" className="action-btn">Guardar Política</button>
            </form>
            {policyResponse && (
              <div className="response-box"><pre>{policyResponse}</pre></div>
            )}
          </section>
        )}

        {activeTab === "alerts" && (
          <section className="card">
            <h3>🚨 Centro de Alertas Críticas</h3>
            <div className="alert-item critical">
              <p><strong>Op-001: Transferencia bloqueada por exceder límite</strong></p>
              <small>Agente: sentinel-demo-agent • Red: near-testnet • Riesgo: 85%</small>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}