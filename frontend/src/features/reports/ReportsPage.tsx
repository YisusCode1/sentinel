import { ArrowRight, Calendar, Download, FileBarChart2, Filter, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import GlassContainer from '../../components/ui/GlassContainer';
import type { Tab } from '../../components/layout/navigation';
import './reports.css';

interface ReportsPageProps {
  active: boolean;
  onNavigate: (tab: Tab) => void;
}

export default function ReportsPage({ active, onNavigate }: ReportsPageProps) {
  if (!active) return null;

  return (
    <div className="reports-page" role="region" aria-label="Módulo de Reportes de Seguridad">
      {/* 1. Header de sección */}
      <div className="section-heading">
        <h2>Reportes ejecutivos de seguridad</h2>
        <span className="demo-label">Consolidación de auditoría · Cumplimiento de políticas</span>
      </div>

      {/* 2. Barra de herramientas con filtros de periodo y botón de exportar deshabilitado */}
      <div className="reports-toolbar" aria-label="Filtros de periodo de reporte">
        <div className="reports-filters-group">
          {/* Selector de periodo fantasma */}
          <div className="reports-filter-skeleton flex items-center gap-2 px-3 min-w-[170px]" aria-hidden="true">
            <Calendar size={15} className="text-[#A1A8B5]" />
            <span className="text-[13px] text-[#A1A8B5]">Últimos 30 días (UTC)</span>
          </div>

          {/* Selector de red blockchain fantasma */}
          <div className="reports-filter-skeleton flex items-center gap-2 px-3 min-w-[150px]" aria-hidden="true">
            <Filter size={15} className="text-[#A1A8B5]" />
            <span className="text-[13px] text-[#A1A8B5]">Todas las redes</span>
          </div>

          {/* Selector de política fantasma */}
          <div className="reports-filter-skeleton flex items-center gap-2 px-3 min-w-[150px]" aria-hidden="true">
            <ShieldCheck size={15} className="text-[#A1A8B5]" />
            <span className="text-[13px] text-[#A1A8B5]">Todas las políticas</span>
          </div>
        </div>

        {/* Botón Exportar visible pero deshabilitado */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="reports-export-btn"
          title="Exportación deshabilitada hasta generar el primer reporte"
        >
          <Download size={15} aria-hidden="true" />
          Exportar reporte (CSV / PDF)
        </button>
      </div>

      {/* 3. Skeleton Layout: Cuadrícula de KPIs y Gráficos con efecto Shimmer */}
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        {/* KPI Skeletons */}
        <div className="reports-skeleton-grid">
          <div className="reports-skeleton-card">
            <div className="reports-shimmer h-3 w-32 mb-3" />
            <div className="reports-shimmer h-8 w-20 mb-2" />
            <div className="reports-shimmer h-3 w-40" />
          </div>
          <div className="reports-skeleton-card">
            <div className="reports-shimmer h-3 w-36 mb-3" />
            <div className="reports-shimmer h-8 w-24 mb-2" />
            <div className="reports-shimmer h-3 w-36" />
          </div>
          <div className="reports-skeleton-card">
            <div className="reports-shimmer h-3 w-28 mb-3" />
            <div className="reports-shimmer h-8 w-16 mb-2" />
            <div className="reports-shimmer h-3 w-44" />
          </div>
        </div>

        {/* Chart Skeletons */}
        <div className="reports-chart-skeleton-container">
          <div className="reports-chart-skeleton-card">
            <div className="flex justify-between items-center mb-4">
              <div className="reports-shimmer h-4 w-48" />
              <div className="reports-shimmer h-3 w-24" />
            </div>
            {/* Ghost Bars */}
            <div className="reports-ghost-bars">
              <div className="reports-ghost-bar" style={{ height: '35%' }} />
              <div className="reports-ghost-bar" style={{ height: '60%' }} />
              <div className="reports-ghost-bar" style={{ height: '45%' }} />
              <div className="reports-ghost-bar" style={{ height: '80%' }} />
              <div className="reports-ghost-bar" style={{ height: '65%' }} />
              <div className="reports-ghost-bar" style={{ height: '90%' }} />
              <div className="reports-ghost-bar" style={{ height: '75%' }} />
              <div className="reports-ghost-bar" style={{ height: '85%' }} />
            </div>
          </div>

          <div className="reports-chart-skeleton-card">
            <div className="flex justify-between items-center mb-4">
              <div className="reports-shimmer h-4 w-40" />
              <div className="reports-shimmer h-3 w-20" />
            </div>
            <div className="grid place-items-center h-[170px]">
              <div className="w-28 h-28 rounded-full border-4 border-cyan-500/20 border-t-cyan-500/60 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Empty State Mejorado con Ilustración, Glassmorphism y Call to Action (CTA) */}
      <GlassContainer
        as="section"
        intensity="intense"
        className="reports-empty-state-overlay"
        aria-label="Estado sin reportes consolidados"
      >
        <div className="reports-empty-icon-wrap" aria-hidden="true">
          <FileBarChart2 size={36} strokeWidth={1.75} />
        </div>

        <h3 className="reports-empty-title">Aún no hay reportes de auditoría generados</h3>

        <p className="reports-empty-desc">
          Los reportes consolidados y métricas de cumplimiento se calculan automáticamente a partir de las evaluaciones de operaciones registradas y las políticas activas de tu organización.
        </p>

        <div className="reports-empty-actions">
          <Button
            variant="primary"
            type="button"
            onClick={() => onNavigate('operaciones')}
          >
            Evaluar primera operación
            <ArrowRight size={16} aria-hidden="true" />
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={() => onNavigate('policies')}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Ver políticas configuradas
          </Button>
        </div>
      </GlassContainer>
    </div>
  );
}
