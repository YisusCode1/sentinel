import { Activity, AlertTriangle, FileText, LayoutDashboard, Lock, Settings } from 'lucide-react';
import type { Locale } from '../../i18n';
import { translations } from '../../i18n';

export type Tab = 'dashboard' | 'operaciones' | 'alerts' | 'policies' | 'reportes' | 'configuracion';

export function getNavigation(locale: Locale = 'es') {
  const strings = translations[locale].nav;
  return [
    { id: 'dashboard', label: strings.dashboard, title: strings.dashboardTitle, icon: LayoutDashboard },
    { id: 'operaciones', label: strings.operaciones, title: strings.operacionesTitle, icon: Activity },
    { id: 'alerts', label: strings.alerts, title: strings.alertsTitle, icon: AlertTriangle },
    { id: 'policies', label: strings.policies, title: strings.policiesTitle, icon: Lock },
    { id: 'reportes', label: strings.reportes, title: strings.reportesTitle, icon: FileText },
    { id: 'configuracion', label: strings.configuracion, title: strings.configuracionTitle, icon: Settings },
  ] as const;
}

export type AlertsCount = { count: number | null; loading: boolean; error: boolean };

export function connectionInfo(status: string, locale: Locale = 'es') {
  const strings = translations[locale].status;
  return {
    label: status === 'healthy' ? strings.connected : status === 'checking' ? strings.checking : strings.disconnected,
    tone: status === 'healthy' ? 'online' : status === 'checking' ? '' : 'offline',
  };
}
