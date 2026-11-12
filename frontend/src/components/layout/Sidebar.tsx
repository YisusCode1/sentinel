import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import sentinelLogo from '../../assets/sentinel-logo.png';
import { connectionInfo, navigation } from './navigation';
import type { AlertsCount, Tab } from './navigation';

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  backendStatus: string;
  checkedAt: Date | null;
  alerts: AlertsCount;
}

export default function Sidebar({ activeTab, onNavigate, collapsed = false, onToggle, onClose, backendStatus, checkedAt, alerts }: Props) {
  const reduceMotion = useReducedMotion();
  const connection = connectionInfo(backendStatus);
  const alertDescription = alerts.error ? 'Error al consultar alertas' : alerts.loading && alerts.count === null ? 'Consultando alertas' : `${alerts.count ?? 0} evaluaciones rechazadas`;

  return (
    <motion.div className="shell-sidebar-content" initial={reduceMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
      <div className="shell-brand">
        <img src={sentinelLogo} alt="" width={36} height={36} />
        <div className="shell-brand-copy"><strong>sentinel<span>.</span></strong><small>Blockchain Intelligence</small></div>
        {collapsed && <span className="sr-only">Sentinel</span>}
        {onClose && <button className="shell-icon-button" type="button" onClick={onClose} aria-label="Cerrar navegación" autoFocus><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="shell-nav-heading"><span>WORKSPACE</span><span className="shell-nav-line" /></div>
      <nav className="shell-nav" aria-label="Navegación principal">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`shell-nav-link ${activeTab === id ? 'is-active' : ''}`}
            onClick={() => onNavigate(id)} aria-label={id === 'alerts' ? `${label}: ${alertDescription}` : label}
            aria-current={activeTab === id ? 'page' : undefined} title={collapsed ? label : undefined}>
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            <span className="shell-nav-label">{label}</span>
            {id === 'alerts' && <span className={`shell-alert-count numeric ${alerts.error ? 'is-error' : ''}`} aria-hidden="true">{alerts.error ? '?' : alerts.loading && alerts.count === null ? '…' : (alerts.count ?? 0).toLocaleString('es-PE')}</span>}
          </button>
        ))}
      </nav>
      <div className="shell-sidebar-bottom">
        <div className="shell-service" title={collapsed ? connection.label : undefined}>
          <span className={`dot ${connection.tone}`} aria-hidden="true" />
          <div className="shell-service-copy"><p>{connection.label}</p>{checkedAt && <small>Última comprobación<br /><time dateTime={checkedAt.toISOString()}>{new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(checkedAt)} · Lima</time></small>}</div>
          {collapsed && <span className="sr-only">{connection.label}</span>}
        </div>
        {onToggle && <button type="button" className="shell-collapse" onClick={onToggle} aria-expanded={!collapsed} aria-controls="desktop-navigation" aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'} title={collapsed ? 'Expandir navegación' : undefined}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}<span>Contraer panel</span>
        </button>}
      </div>
    </motion.div>
  );
}
