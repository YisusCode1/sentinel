import { Activity, AlertTriangle, FileText, LayoutDashboard, Lock, Settings } from 'lucide-react';

export type Tab = 'dashboard' | 'operaciones' | 'alerts' | 'policies' | 'reportes' | 'configuracion';

export const navigation = [
  { id: 'dashboard', label: 'Dashboard', title: 'Centro de control', icon: LayoutDashboard },
  { id: 'operaciones', label: 'Operaciones', title: 'Supervisión de operaciones', icon: Activity },
  { id: 'alerts', label: 'Alertas', title: 'Centro de alertas', icon: AlertTriangle },
  { id: 'policies', label: 'Políticas', title: 'Políticas de seguridad', icon: Lock },
  { id: 'reportes', label: 'Reportes', title: 'Reportes de seguridad', icon: FileText },
  { id: 'configuracion', label: 'Configuración', title: 'Configuración del sistema', icon: Settings },
] as const;

export type AlertsCount = { count: number | null; loading: boolean; error: boolean };

export function connectionInfo(status: string) {
  return {
    label: status === 'healthy' ? 'Backend conectado' : status === 'checking' ? 'Verificando conexión' : 'Backend sin conexión',
    tone: status === 'healthy' ? 'online' : status === 'checking' ? '' : 'offline',
  };
}
