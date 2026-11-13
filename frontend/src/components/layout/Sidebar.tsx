import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import sentinelLogo from '../../assets/sentinel-logo.png';
import { connectionInfo, getNavigation } from './navigation';
import type { AlertsCount, Tab } from './navigation';
import type { Locale } from '../../i18n';
import { translations } from '../../i18n';

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  backendStatus: string;
  checkedAt: Date | null;
  alerts: AlertsCount;
  locale: Locale;
}

export default function Sidebar({ activeTab, onNavigate, collapsed = false, onToggle, onClose, backendStatus, checkedAt, alerts, locale }: Props) {
  const reduceMotion = useReducedMotion();
  const navigation = getNavigation(locale);
  const connection = connectionInfo(backendStatus, locale);
  const strings = translations[locale].global;
  const localeFormat = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-PE';
  const alertDescription = alerts.error
    ? strings.alertError
    : alerts.loading && alerts.count === null
      ? strings.alertLoading
      : strings.alertSummary.replace('{count}', String(alerts.count ?? 0));

  return (
    <motion.div className="shell-sidebar-content" initial={reduceMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
      <div className="shell-brand">
        <img src={sentinelLogo} alt="" width={36} height={36} />
        <div className="shell-brand-copy"><strong>sentinel<span>.</span></strong><small>{strings.backendBrand}</small></div>
        {collapsed && <span className="sr-only">{strings.sentinel}</span>}
        {onClose && <button className="shell-icon-button" type="button" onClick={onClose} aria-label={strings.closeNav} autoFocus><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="shell-nav-heading"><span>{strings.statusWorkSpace}</span><span className="shell-nav-line" /></div>
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
          <div className="shell-service-copy"><p>{connection.label}</p>{checkedAt && <small>{strings.lastCheck}<br /><time dateTime={checkedAt.toISOString()}>{new Intl.DateTimeFormat(localeFormat, { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(checkedAt)} · Lima</time></small>}</div>
          {collapsed && <span className="sr-only">{connection.label}</span>}
        </div>
        {onToggle && <button type="button" className="shell-collapse" onClick={onToggle} aria-expanded={!collapsed} aria-controls="desktop-navigation" aria-label={collapsed ? strings.expandPanel : strings.minimizePanel} title={collapsed ? strings.expandPanel : undefined}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}<span>{strings.collapsePanel}</span>
        </button>}
      </div>
    </motion.div>
  );
}
