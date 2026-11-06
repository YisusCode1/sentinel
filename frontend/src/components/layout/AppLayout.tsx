import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Menu, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Sidebar from './Sidebar';
import { useToastHost } from '../ui/ToastProvider';
import { connectionInfo, navigation } from './navigation';
import type { AlertsCount, Tab } from './navigation';
import './layout.css';

interface Props {
  children: ReactNode;
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  backendStatus: string;
  checkedAt: Date | null;
  alerts: AlertsCount;
}

export default function AppLayout({ children, activeTab, onNavigate, backendStatus, checkedAt, alerts }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const setToastHost = useToastHost();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousTab = useRef(activeTab);
  const focusMainAfterClose = useRef(false);
  const reduceMotion = useReducedMotion();
  const current = navigation.find(item => item.id === activeTab)!;
  const connection = connectionInfo(backendStatus);

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
      <a className="shell-skip-link" href="#main-content">Saltar al contenido</a>
      <aside id="desktop-navigation" className="shell-sidebar" aria-label="Panel de navegación">
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
      </aside>
      <dialog ref={dialogRef} id="mobile-navigation" className="shell-mobile-dialog" aria-label="Navegación de Sentinel"
        onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
        <div className="shell-mobile-panel"><Sidebar {...sidebarProps} onClose={() => setMobileOpen(false)} /></div>
      </dialog>
      <div className="shell-workspace">
        <header className="shell-topbar">
          <div className="shell-breadcrumb">
            <button type="button" className="shell-icon-button shell-menu-toggle" aria-label="Abrir navegación" aria-controls="mobile-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" /></button>
            <span className="shell-workspace-name">Sentinel</span><ChevronRight size={14} aria-hidden="true" /><span>{current.label}</span>
          </div>
          <div className="shell-connection" role="status"><span className={`dot ${connection.tone}`} aria-hidden="true" /><span>{connection.label}</span></div>
        </header>
        <main ref={mainRef} id="main-content" className="shell-main" tabIndex={-1}>
          <motion.header className="shell-page-heading" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div><p className="eyebrow">INTELIGENCIA Y CONTROL DE RIESGO</p><h1>{current.title}</h1></div>
            <span className="shell-context"><ShieldCheck size={15} aria-hidden="true" />IA + Blockchain</span>
          </motion.header>
          {/* Keep feature instances mounted so filters and draft forms survive navigation. */}
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.08 }}>{children}</motion.div>
          <footer className="shell-footer"><span>Sentinel / Blockchain Intelligence</span><span>Supervisión · Análisis · Control</span></footer>
        </main>
      </div>
    </div>
  );
}
