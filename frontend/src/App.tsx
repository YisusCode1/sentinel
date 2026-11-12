import { useEffect, useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import GlassContainer from './components/ui/GlassContainer';
import { useToast } from './components/ui/ToastProvider';
import type { Tab } from './components/layout/navigation';
import Dashboard from './features/dashboard/Dashboard';
import OperationsPage from './features/operations/OperationsPage';
import PoliciesPage from './features/policies/PoliciesPage';
import AlertsPage from './features/alerts/AlertsPage';
import ConfigPage from './features/config/ConfigPage';
import ReportsPage from './features/reports/ReportsPage';
import { API_BASE_URL, apiRequest } from './lib/api';
import type { OperationRecord, PolicyRecord } from './features/operations/types';
import './App.css';

export default function App() {
  const notify = useToast();
  const [backendStatus, setBackendStatus] = useState("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

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

  // Update navigation alerts count: query GET /operations?decision=rejected&limit=100
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<OperationRecord[]>("/operations?decision=rejected&limit=100", {
      signal: controller.signal,
    })
      .then((data) => {
        setAlertsCountState({ count: Array.isArray(data) ? data.length : 0, loading: false, error: false });
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
  };

  const handleEvaluateWithPolicy = (policyId: string) => {
    setPreselectedPolicyId(policyId);
    setActiveTab("operaciones");
  };

  const handleNavigateToPolicy = (_policyId: string) => {
    setActiveTab("policies");
  };

  const handleOperationEvaluated = (record: OperationRecord) => {
    setAlertsRefreshSignal((s) => s + 1);
    notify({ title: record.decision === 'approved' ? 'Evaluación aprobada por política' : 'Evaluación rechazada por política', description: record.reason, tone: record.decision === 'approved' ? 'success' : 'warning', key: `evaluation-${record.operation_id}` });
  };

  const handlePolicyCreated = (policy: PolicyRecord) => {
    setPolicyRefreshSignal((s) => s + 1);
    notify({ title: 'Política creada', description: policy.name, tone: 'success', key: `policy-${policy.id}` });
  };

  return (
    <div className="relative min-h-screen bg-[#05070D] text-[#FAFAFA] overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Luces de iluminación ambiental fijas en el fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Fondo con degradado sutil de negro carbón puro a gris profundo */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030508] via-[#070B14] to-[#020306]" />

        {/* Orbe 1: Cian Neón Tecnológico (Superior Derecha) */}
        <div
          className="absolute -top-36 -right-36 w-[680px] h-[680px] rounded-full pointer-events-none opacity-50 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.22) 0%, rgba(6, 182, 212, 0.08) 42%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Orbe 2: Púrpura Web3 Accent (Centro / Lateral Izquierdo) */}
        <div
          className="absolute top-1/3 -left-40 w-[620px] h-[620px] rounded-full pointer-events-none opacity-45 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.20) 0%, rgba(126, 34, 206, 0.06) 45%, transparent 70%)',
            filter: 'blur(95px)',
          }}
        />

        {/* Orbe 3: Azul Zafiro Institucional (Inferior Derecha) */}
        <div
          className="absolute -bottom-28 right-1/4 w-[540px] h-[540px] rounded-full pointer-events-none opacity-35 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(30, 58, 138, 0.05) 50%, transparent 70%)',
            filter: 'blur(85px)',
          }}
        />
      </div>

      {/* Capa de aplicación interactiva sobre las luces ambientales */}
      <div className="relative z-10 min-h-screen">
        <AppLayout
          activeTab={activeTab}
          onNavigate={handleNavClick}
          backendStatus={backendStatus}
          checkedAt={checkedAt}
          alerts={alertsCountState}
        >
          {/* Contenedor Wet Glass principal que refracta la iluminación ambiental */}
          <GlassContainer
            as="div"
            intensity="medium"
            className="p-5 sm:p-7 lg:p-8"
          >
            {activeTab === 'dashboard' && <Dashboard backendStatus={backendStatus} onNavigate={handleNavClick} />}
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

            <ReportsPage
              active={activeTab === "reportes"}
              onNavigate={handleNavClick}
            />
          </GlassContainer>
        </AppLayout>
      </div>
    </div>
  );
}
