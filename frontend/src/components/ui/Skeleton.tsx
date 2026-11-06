import type { CSSProperties } from 'react';
import './skeleton.css';

export function Skeleton({ variant = 'line', className = '' }: { variant?: 'line' | 'title' | 'block'; className?: string }) {
  return <span className={`ui-skeleton ui-skeleton--${variant} ${className}`.trim()} aria-hidden="true" />;
}

export function TableSkeleton({ label, columns = 5, rows = 5 }: { label: string; columns?: number; rows?: number }) {
  return (
    <div className="ui-loading-state" role="status" aria-live="polite" aria-atomic="true">
      <p className="ui-loading-label">{label}</p>
      <div className="ui-skeleton-table" aria-hidden="true" style={{ '--skeleton-columns': columns } as CSSProperties}>
        {Array.from({ length: rows }, (_, row) => (
          <div className="ui-skeleton-row" key={row}>
            {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={column === 0 ? 'ui-skeleton-wide' : ''} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultSkeleton({ label = 'Consultando evaluación. Esperando la respuesta del servidor…' }: { label?: string }) {
  return (
    <div className="ui-loading-state" role="status" aria-live="polite" aria-atomic="true">
      <p className="ui-loading-label">{label}</p>
      <div className="ui-skeleton-result" aria-hidden="true">
        <Skeleton variant="title" />
        <Skeleton />
        <div className="ui-skeleton-fields">{Array.from({ length: 4 }, (_, i) => <Skeleton variant="block" key={i} />)}</div>
        <Skeleton /><Skeleton className="ui-skeleton-short" />
      </div>
    </div>
  );
}
