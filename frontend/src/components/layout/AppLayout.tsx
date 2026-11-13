import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Menu, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Sidebar from './Sidebar';
import { useToastHost } from '../ui/ToastProvider';
import { connectionInfo, getNavigation } from './navigation';
import type { AlertsCount, Tab } from './navigation';
import { localeOptions, type Locale, translations } from '../../i18n';
import './layout.css';

interface Props {
  children: ReactNode;
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  backendStatus: string;
  checkedAt: Date | null;
  alerts: AlertsCount;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function AppLayout({ children, activeTab, onNavigate, backendStatus, checkedAt, alerts, locale, onLocaleChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const setToastHost = useToastHost();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousTab = useRef(activeTab);
  const focusMainAfterClose = useRef(false);
  const reduceMotion = useReducedMotion();
  const navigation = getNavigation(locale);
  const current = navigation.find(item => item.id === activeTab)!;
  const connection = connectionInfo(backendStatus, locale);
  const strings = translations[locale].global;

  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    setToastHost?.(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      setToastHost?.(null);
      dialog.close();
      if (focusMainAfterClose.current) {
        mainRef.current?.focus({ preventScroll: true });
        focusMainAfterClose.current = false;
      }
    };
  }, [mobileOpen, setToastHost]);

  useEffect(() => {
    document.title = `${current.label} | Sentinel`;
  }, [current.label]);

  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const navigate = (tab: Tab) => {
    onNavigate(tab);
    if (mobileOpen) {
      focusMainAfterClose.current = true;
      setMobileOpen(false);
    }
  };
  const sidebarProps = { activeTab, onNavigate: navigate, backendStatus, checkedAt, alerts };

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="shell-skip-link" href="#main-content">{strings.skipToContent}</a>
      <aside id="desktop-navigation" className="shell-sidebar" aria-label={strings.lockedView}>
        <Sidebar {...sidebarProps} locale={locale} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
      </aside>
      <dialog ref={dialogRef} id="mobile-navigation" className="shell-mobile-dialog" aria-label={strings.lockedView}
        onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
        <div className="shell-mobile-panel"><Sidebar {...sidebarProps} locale={locale} onClose={() => setMobileOpen(false)} /></div>
      </dialog>
      <div className="shell-workspace">
        <header className="shell-topbar">
          <div className="shell-breadcrumb">
            <button type="button" className="shell-icon-button shell-menu-toggle" aria-label={strings.openedNav} aria-controls="mobile-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" /></button>
            <span className="shell-workspace-name">{strings.sentinel}</span><ChevronRight size={14} aria-hidden="true" /><span>{current.label}</span>
          </div>
          <div className="shell-topbar-actions">
            <label className="shell-language-toggle" aria-label={translations[locale].config.language}>
              <select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)} aria-label={translations[locale].config.language}>
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="shell-connection" role="status"><span className={`dot ${connection.tone}`} aria-hidden="true" /><span>{connection.label}</span></div>
          </div>
        </header>
        <main ref={mainRef} id="main-content" className="shell-main" tabIndex={-1}>
          <motion.header className="shell-page-heading" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div><p className="eyebrow">{strings.riskIntelligence}</p><h1>{current.title}</h1></div>
            <span className="shell-context"><ShieldCheck size={15} aria-hidden="true" />{strings.aiPlusBlockchain}</span>
          </motion.header>
          {/* Keep feature instances mounted so filters and draft forms survive navigation. */}
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.08 }}>{children}</motion.div>
          <footer className="shell-footer"><span>{strings.sentinel} / {strings.backendBrand}</span><span>{strings.supervision}</span></footer>
        </main>
      </div>
    </div>
  );
}
