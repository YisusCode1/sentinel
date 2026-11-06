import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import './toast.css';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: 'success' | 'error' | 'warning' | 'info';
  key?: string;
}
interface Toast extends ToastInput { id: number }
const ToastContext = createContext<((input: ToastInput) => void) | null>(null);
const ToastHostContext = createContext<((host: HTMLElement | null) => void) | null>(null);

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const present = useIsPresent();
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduceMotion = useReducedMotion();
  const tone = toast.tone ?? 'info';
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : CircleAlert;

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    // Errors and warnings remain until dismissed. Pause other messages while read.
    if (paused || hidden || tone === 'error' || tone === 'warning') return;
    const timer = window.setTimeout(() => dismiss(toast.id), 8000);
    return () => window.clearTimeout(timer);
  }, [toast, paused, hidden, tone, dismiss]);

  return (
    <motion.li ref={ref} inert={!present} aria-hidden={!present || undefined} className={`ui-toast ui-toast--${tone}`} initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <Icon className="ui-toast-icon" size={19} aria-hidden="true" />
      <div><p className="ui-toast-title">{toast.title}</p>{toast.description && <p className="ui-toast-description">{toast.description}</p>}</div>
      <button type="button" className="ui-toast-close" aria-label={`Cerrar notificación: ${toast.title}`} onClick={() => {
        const sibling = ref.current?.nextElementSibling ?? ref.current?.previousElementSibling;
        const focusTarget = sibling?.querySelector<HTMLButtonElement>('button')
          ?? ref.current?.closest('dialog')?.querySelector<HTMLButtonElement>('button:not(.ui-toast-close)')
          ?? document.querySelector<HTMLElement>('main');
        dismiss(toast.id);
        focusTarget?.focus({ preventScroll: true });
      }}><X size={16} aria-hidden="true" /></button>
    </motion.li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const nextId = useRef(0);
  const notify = useCallback((input: ToastInput) => {
    const id = ++nextId.current;
    setToasts(previous => [...previous.filter(toast => !input.key || toast.key !== input.key), { ...input, id }]);
    setAnnouncement({ id, text: `${input.tone === 'error' ? 'Error. ' : ''}${input.title}` });
  }, []);
  const dismiss = useCallback((id: number) => setToasts(previous => previous.filter(toast => toast.id !== id)), []);
  const viewport = (
    <section className="ui-toast-viewport" aria-label="Notificaciones">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true"><span key={announcement.id}>{announcement.text}</span></div>
      <ol className="ui-toast-list"><AnimatePresence initial={false}>{toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}</AnimatePresence></ol>
    </section>
  );
  return (
    <ToastHostContext.Provider value={setHost}><ToastContext.Provider value={notify}>
      {children}
      {host ? createPortal(viewport, host) : viewport}
    </ToastContext.Provider></ToastHostContext.Provider>
  );
}

/** Keep notifications within the active native dialog's focus boundary. */
export function useToastHost() {
  return useContext(ToastHostContext);
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast requires ToastProvider');
  return notify;
}
