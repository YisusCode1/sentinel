import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useToastHost } from './ToastProvider';
import './modal.css';

export default function Modal({ children, labelledBy, onClose }: { children: ReactNode; labelledBy: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const setToastHost = useToastHost();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    setToastHost?.(dialog);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { setToastHost?.(null); dialog.close(); document.body.style.overflow = overflow; };
  }, [setToastHost]);
  return (
    <dialog ref={ref} className="ui-modal" aria-labelledby={labelledBy} onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      {children}
    </dialog>
  );
}
