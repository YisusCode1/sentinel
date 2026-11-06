import Card from '../../components/ui/Card';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Box, CheckCircle2, Key, Lock, Minus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Tab } from '../../components/layout/navigation';
import { connectionInfo } from '../../components/layout/navigation';
import DashboardHero from './DashboardHero';

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
    <Card as="article" className="metric-card" aria-label={title}>
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
    </Card>
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


export default function Dashboard({ backendStatus, onNavigate }: { backendStatus: string; onNavigate: (tab: Tab) => void }) {
  const reduceMotion = useReducedMotion();
  const isOnline = backendStatus === 'healthy';
  const connectionClass = connectionInfo(backendStatus).tone;
  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* 1. Presentación y bienvenida: Inteligencia Preventiva para contextualizar al usuario */}
      <DashboardHero onNavigate={onNavigate} />

      {/* 2. Indicadores clave de supervisión (KPIs) */}
      <div className="section-heading">
        <h2 id="metrics-heading">Indicadores clave de supervisión (KPIs)</h2>
        <span className="demo-label">Vista en tiempo real · Métricas operativas</span>
      </div>
      <section className="metrics-grid" aria-labelledby="metrics-heading">
        {demoMetrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
      </section>

      <div className="grid-split">
        <Card className="card" aria-labelledby="activity-heading">
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
        </Card>
        <Card className="card" aria-labelledby="system-heading">
          <div className="card-header-row"><h3 id="system-heading">Estado del sistema</h3><Activity size={17} aria-hidden="true" /></div>
          <div className="availability"><div><p className="numeric">99.9%</p><p className="availability-label">Disponibilidad ilustrativa</p></div><span className="badge-pill inf">Demo</span></div>
          <ul className="service-list">
            <li><span>Backend FastAPI</span><strong className={connectionClass}>{isOnline ? "Conectado" : backendStatus === "checking" ? "Verificando" : "Sin conexión"}</strong></li>
            {["Base de datos", "Conexión NEAR", "Gemini AI"].map((service) => <li key={service}><span>{service}</span><strong>Sin verificar</strong></li>)}
          </ul>
        </Card>
      </div>
      <div className="grid-split">
        <Card className="card" aria-labelledby="policies-heading">
          <div className="card-header-row"><h3 id="policies-heading"><Lock size={17} aria-hidden="true" />Políticas de seguridad</h3><button className="link-text" onClick={() => onNavigate("policies")}>Ver todas →</button></div>
          <p className="demo-label">Controles de demostración · Cambios locales</p>
          <ul className="policy-list-mini">
            {demoPolicies.map((name) => <li key={name}><span>{name}</span><label className="switch"><input type="checkbox" defaultChecked aria-label={name} /><span className="slider" /></label></li>)}
          </ul>
        </Card>
        <Card className="card" aria-labelledby="alerts-heading">
          <div className="card-header-row"><h3 id="alerts-heading"><AlertTriangle size={17} aria-hidden="true" />Últimas alertas</h3><button className="link-text" onClick={() => onNavigate("alerts")}>Ver todas →</button></div>
          <RecentAlerts />
        </Card>
      </div>

    </motion.div>
  );
}
