import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Activity, AlertTriangle, Box, CheckCircle2, Key, Lock, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Tab } from '../../components/layout/navigation';
import { connectionInfo } from '../../components/layout/navigation';
import DashboardHero from './DashboardHero';
import { apiRequest } from '../../lib/api';
import type { OperationRecord, PolicyRecord } from '../operations/types';
import { displayDate } from '../operations/utils';
import { NearExplorerLink } from '../operations/OperationResult';

interface MetricItem {
  title: string;
  value: string;
  description: string;
  tone: 'primary' | 'success' | 'critical' | 'neutral';
  icon: typeof Box;
}

function MetricCard({ title, value, description, tone, icon: Icon }: MetricItem) {
  return (
    <Card as="article" className="metric-card" aria-label={title}>
      <div className="metric-heading">
        <h3 className="metric-title">{title}</h3>
        <Icon className={`metric-icon ${tone}`} size={19} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="metric-value numeric">{value}</p>
      <div className="metric-comparison">
        <span className="text-xs text-slate-400">{description}</span>
      </div>
    </Card>
  );
}

export default function Dashboard({ backendStatus, onNavigate }: { backendStatus: string; onNavigate: (tab: Tab) => void }) {
  const reduceMotion = useReducedMotion();
  const isOnline = backendStatus === 'healthy';
  const connectionClass = connectionInfo(backendStatus).tone;

  const [operations, setOperations] = useState<OperationRecord[] | null>(null);
  const [policies, setPolicies] = useState<PolicyRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [populating, setPopulating] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- Reset pending state when querying backend data
    setLoading(true);

    Promise.allSettled([
      apiRequest<OperationRecord[]>('/operations?limit=100', { signal: controller.signal }),
      apiRequest<PolicyRecord[]>('/policies', { signal: controller.signal }),
    ]).then(([opsResult, polsResult]) => {
      if (controller.signal.aborted) return;
      if (opsResult.status === 'fulfilled' && Array.isArray(opsResult.value)) {
        setOperations(opsResult.value);
      } else {
        setOperations(null);
      }
      if (polsResult.status === 'fulfilled' && Array.isArray(polsResult.value)) {
        setPolicies(polsResult.value);
      } else {
        setPolicies(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [isOnline]);

  async function populateDemoTelemetry() {
    if (!isOnline || populating) return;
    setPopulating(true);

    try {
      const demoPolicyName = 'Tesorería Corporativa NEAR';
      let demoPolicy = policies?.find((policy) => policy.name === demoPolicyName);

      if (!demoPolicy) {
        demoPolicy = await apiRequest<PolicyRecord>('/policies', {
          method: 'POST',
          body: JSON.stringify({
            name: demoPolicyName,
            max_amount: '100.00',
            allowed_tokens: ['USDC', 'USDT', 'NEAR'],
            allowed_recipients: ['tesoreria.testnet', 'proveedor-autorizado.testnet'],
            allowed_operations: ['transfer', 'swap'],
          }),
        });
      }

      const polId = demoPolicy.id;

      await apiRequest('/operations/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          policy_id: polId,
          network: 'near-testnet',
          operation: 'transfer',
          token: 'USDC',
          amount: '25.00',
          recipient: 'tesoreria.testnet',
        }),
      });

      await apiRequest('/operations/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          policy_id: polId,
          network: 'near-testnet',
          operation: 'transfer',
          token: 'USDC',
          amount: '850.00',
          recipient: 'tesoreria.testnet',
        }),
      });

      await apiRequest('/operations/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          policy_id: polId,
          network: 'near-testnet',
          operation: 'transfer',
          token: 'USDC',
          amount: '15.00',
          recipient: 'drainer-malicious.testnet',
        }),
      });

      const [ops, pols] = await Promise.all([
        apiRequest<OperationRecord[]>('/operations?limit=100'),
        apiRequest<PolicyRecord[]>('/policies'),
      ]);
      setOperations(ops);
      setPolicies(pols);
    } catch (error) {
      console.error('No se pudo cargar la telemetría demo.', error);
      if (typeof window !== 'undefined') {
        window.alert('No se pudo cargar la telemetría demo. Revisa la conexión con el backend.');
      }
    } finally {
      setPopulating(false);
    }
  }

  const totalOps = operations !== null ? operations.length : null;
  const safeOps = operations !== null ? operations.filter((op) => op.decision === 'approved').length : null;
  const alertOps = operations !== null ? operations.filter((op) => op.decision === 'rejected').length : null;
  const activePols = policies !== null ? policies.length : null;

  const metrics: MetricItem[] = [
    {
      title: 'Operaciones Evaluadas',
      value: totalOps !== null ? totalOps.toLocaleString('en-US') : (loading ? '…' : '—'),
      description: totalOps !== null ? 'Evaluadas por Policy Engine' : 'Información no disponible',
      tone: 'primary',
      icon: Box,
    },
    {
      title: 'Operaciones Aprobadas',
      value: safeOps !== null ? safeOps.toLocaleString('en-US') : (loading ? '…' : '—'),
      description: safeOps !== null ? 'Cumplieron con la política' : 'Información no disponible',
      tone: 'success',
      icon: CheckCircle2,
    },
    {
      title: 'Alertas por Rechazo',
      value: alertOps !== null ? alertOps.toLocaleString('en-US') : (loading ? '…' : '—'),
      description: alertOps !== null ? 'Incumplieron reglas de política' : 'Información no disponible',
      tone: 'critical',
      icon: AlertTriangle,
    },
    {
      title: 'Políticas Registradas',
      value: activePols !== null ? activePols.toLocaleString('en-US') : (loading ? '…' : '—'),
      description: activePols !== null ? 'Reglas autoritativas activas' : 'Información no disponible',
      tone: 'neutral',
      icon: Key,
    },
  ];

  const recentRejected = operations ? operations.filter((op) => op.decision === 'rejected').slice(0, 3) : [];
  const displayPolicies = policies ? policies.slice(0, 4) : [];

  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* 1. Presentación y bienvenida: Inteligencia Preventiva para contextualizar al usuario */}
      <DashboardHero onNavigate={onNavigate} />

      {/* 2. Indicadores clave de supervisión (KPIs) */}
      <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 id="metrics-heading">Indicadores clave de supervisión (KPIs)</h2>
          <span className="demo-label">Datos en tiempo real · Servidor Sentinel</span>
        </div>
        {isOnline && totalOps === 0 && (
          <Button variant="secondary" onClick={populateDemoTelemetry} loading={populating} loadingLabel="Poblando telemetría…">
            <Sparkles size={14} className="text-cyan-400" />
            Cargar telemetría demo para jurado
          </Button>
        )}
      </div>
      <section className="metrics-grid" aria-labelledby="metrics-heading">
        {metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
      </section>

      <div className="grid-split">
        <Card className="card" aria-labelledby="activity-heading">
          <div className="chart-header-flex">
            <h3 id="activity-heading">Actividad reciente</h3>
            <span className="demo-label">Registro de operaciones persistidas</span>
          </div>
          {operations && operations.length > 0 ? (
            <div>
              <div className="chart-legend">
                <span><i className="legend-line" />Total ({operations.length})</span>
                <span><i className="legend-line risk" />Rechazos ({recentRejected.length})</span>
              </div>
              <div className="chart-wrapper">
                <svg className="svg-chart" viewBox="0 0 500 120" preserveAspectRatio="none" role="img" aria-label="Línea de evaluaciones">
                  {[0, 30, 60, 90, 120].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} className="chart-grid" />)}
                  <path d="M 0,80 Q 80,60 160,70 T 320,50 T 500,40 L 500,120 L 0,120 Z" fill="var(--azul-marca)" fillOpacity="0.08" />
                  <path d="M 0,80 Q 80,60 160,70 T 320,50 T 500,40" fill="none" stroke="var(--azul-marca)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="chart-axis-labels numeric text-xs text-slate-400 mt-2">
                <span>Últimas operaciones procesadas</span>
                <span>UTC</span>
              </div>
            </div>
          ) : (
            <div className="ops-empty py-8 text-center">
              <Activity size={24} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm text-slate-400">
                {isOnline ? 'Aún no hay operaciones evaluadas en la base de datos.' : 'Información no disponible. Backend desconectado.'}
              </p>
              {isOnline && (
                <button type="button" className="link-text text-xs mt-2" onClick={populateDemoTelemetry} disabled={populating}>
                  <Sparkles size={13} /> Cargar telemetría demo (1 clic)
                </button>
              )}
            </div>
          )}
        </Card>

        <Card className="card" aria-labelledby="system-heading">
          <div className="card-header-row"><h3 id="system-heading">Estado del sistema</h3><Activity size={17} aria-hidden="true" /></div>
          <div className="availability">
            <div>
              <p className="numeric">{isOnline ? 'Operativo' : 'Inactivo'}</p>
              <p className="availability-label">Estado de infraestructura</p>
            </div>
            <span className={`badge-pill ${isOnline ? 'succ' : 'warn'}`}>{isOnline ? 'En línea' : 'Desconectado'}</span>
          </div>
          <ul className="service-list">
            <li>
              <span>Backend FastAPI</span>
              <strong className={connectionClass}>{isOnline ? 'Conectado' : backendStatus === 'checking' ? 'Verificando' : 'Sin conexión'}</strong>
            </li>
            <li>
              <span>Policy Engine</span>
              <strong className="text-cyan-400">Autoritativo (Activo)</strong>
            </li>
            <li>
              <span>Gemini AI Engine</span>
              <strong className="text-cyan-400">Asesor de Riesgo</strong>
            </li>
            <li>
              <span>Autenticación</span>
              <strong className="text-slate-300">X-API-Key</strong>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid-split">
        <Card className="card" aria-labelledby="policies-heading">
          <div className="card-header-row">
            <h3 id="policies-heading"><Lock size={17} aria-hidden="true" />Políticas de seguridad</h3>
            <button className="link-text" onClick={() => onNavigate('policies')}>Ver todas →</button>
          </div>
          <p className="demo-label">Reglas persistidas en el servidor</p>
          {displayPolicies.length > 0 ? (
            <ul className="policy-list-mini">
              {displayPolicies.map((p) => (
                <li key={p.id}>
                  <div>
                    <span className="font-medium text-slate-200">{p.name}</span>
                    <small className="block text-xs text-slate-400">
                      Límite: <strong className="numeric">{p.max_amount}</strong> · {p.allowed_tokens.join(', ')}
                    </small>
                  </div>
                  <span className="badge-pill succ">Activa</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ops-empty py-6 text-center">
              <p className="text-sm text-slate-400">
                {isOnline ? 'No hay políticas configuradas en la base de datos.' : 'Información no disponible.'}
              </p>
              {isOnline && (
                <button type="button" className="link-text text-xs mt-2" onClick={() => onNavigate('policies')}>
                  + Crear primera política
                </button>
              )}
            </div>
          )}
        </Card>

        <Card className="card" aria-labelledby="alerts-heading">
          <div className="card-header-row">
            <h3 id="alerts-heading"><AlertTriangle size={17} aria-hidden="true" />Últimas alertas</h3>
            <button className="link-text" onClick={() => onNavigate('alerts')}>Ver todas →</button>
          </div>
          {recentRejected.length > 0 ? (
            recentRejected.map((alert) => (
              <div className="alert-item critical" key={alert.id || alert.operation_id}>
                <div className="alert-row">
                  <p><strong>{alert.reason}</strong></p>
                  <span className="badge-pill crit">Rechazada</span>
                </div>
                <small style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>{displayDate(alert.created_at)}</span>
                  <span>·</span>
                  <span className="numeric">{alert.amount} {alert.token}</span>
                  <span>·</span>
                  <NearExplorerLink address={alert.recipient} />
                  {alert.ai_analysis && alert.ai_analysis.risk_level !== 'unknown' && (
                    <>
                      <span>·</span>
                      <span className="badge-pill warn" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                        Riesgo IA: {alert.ai_analysis.risk_score}/100
                      </span>
                    </>
                  )}
                </small>
              </div>
            ))
          ) : (
            <div className="ops-empty py-6 text-center">
              <p className="text-sm text-slate-400">
                {isOnline ? 'No hay alertas por rechazo registradas.' : 'Información no disponible.'}
              </p>
            </div>
          )}
        </Card>
      </div>

    </motion.div>
  );
}
