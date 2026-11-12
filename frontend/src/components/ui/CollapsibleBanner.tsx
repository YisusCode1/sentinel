import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import './collapsible-banner.css';

export interface CollapsibleBannerProps {
  /** Identificador único para persistir en localStorage si fue descartado o colapsado */
  id: string;
  /** Título principal del aviso */
  title: string;
  /** Contenido o descripción del aviso */
  children: ReactNode;
  /** Icono opcional (por defecto Info) */
  icon?: ReactNode;
  /** Tono visual */
  tone?: 'info' | 'warning' | 'critical';
  /** Etiqueta de región accesible */
  ariaLabel?: string;
  /** Clases CSS adicionales */
  className?: string;
}

export default function CollapsibleBanner({
  id,
  title,
  children,
  icon,
  tone = 'info',
  ariaLabel,
  className = '',
}: CollapsibleBannerProps) {
  const dismissStorageKey = `sentinel_banner_dismissed_${id}`;
  const collapseStorageKey = `sentinel_banner_collapsed_${id}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(dismissStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(collapseStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissStorageKey, 'true');
    } catch {
      // ignore
    }
  };

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(collapseStorageKey, String(next));
    } catch {
      // ignore
    }
  };

  const mainIcon = icon ?? <Info size={18} className="banner-main-icon" aria-hidden="true" />;

  return (
    <div
      className={`collapsible-banner tone-${tone} ${collapsed ? 'is-collapsed' : ''} ${className}`.trim()}
      role="region"
      aria-label={ariaLabel ?? title}
    >
      {collapsed ? (
        <div className="banner-collapsed-row">
          {/* Tooltip trigger con icono ⓘ */}
          <div
            className="banner-tooltip-trigger"
            tabIndex={0}
            role="button"
            aria-label={`Ver detalles de: ${title}`}
            aria-describedby={`tooltip-${id}`}
          >
            {mainIcon}
            <div id={`tooltip-${id}`} className="banner-tooltip-popover" role="tooltip">
              <strong className="banner-title">{title}</strong>
              <div className="banner-description">{children}</div>
            </div>
          </div>

          <span className="banner-collapsed-title">{title}</span>

          <div className="banner-actions">
            <button
              type="button"
              className="banner-btn-text"
              onClick={handleToggleCollapse}
              aria-expanded="false"
              aria-label="Expandir aviso completo"
            >
              Expandir aviso
            </button>
            <button
              type="button"
              className="banner-btn-icon"
              onClick={handleToggleCollapse}
              aria-label="Expandir aviso"
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="banner-btn-text"
              onClick={handleDismiss}
              aria-label="No volver a mostrar este aviso"
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      ) : (
        <>
          {mainIcon}
          <div className="banner-content">
            <strong className="banner-title">{title}</strong>
            <div className="banner-description">{children}</div>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="banner-btn-text"
              onClick={handleDismiss}
              title="Guardar preferencia y ocultar permanentemente"
              aria-label="No volver a mostrar este aviso"
            >
              No volver a mostrar
            </button>
            <button
              type="button"
              className="banner-btn-icon"
              onClick={handleToggleCollapse}
              aria-expanded="true"
              aria-label="Colapsar aviso a una sola línea"
              title="Colapsar a una línea"
            >
              <ChevronUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="banner-btn-icon"
              onClick={handleDismiss}
              aria-label="Cerrar aviso"
              title="Cerrar"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
