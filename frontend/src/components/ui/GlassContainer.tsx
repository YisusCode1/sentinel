import type { ElementType, HTMLAttributes, ReactNode } from 'react';

export type GlassIntensity = 'light' | 'medium' | 'intense' | 'ligero' | 'medio' | 'intenso';
export type GlassGlow = 'none' | 'brand' | 'accent' | 'neon-cyan' | 'neon-purple';

export interface GlassContainerProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /**
   * Nivel de intensidad del efecto Wet Glass:
   * - 'light' | 'ligero': Desenfoque ligero (16px), ideal para tarjetas secundarias o widgets.
   * - 'medium' | 'medio': Desenfoque medio (24px) y translucidez profunda para paneles principales.
   * - 'intense' | 'intenso': Efecto "Wet Glass" completo (32px blur, reflejo especular e iluminación interior).
   */
  intensity?: GlassIntensity;
  /**
   * Resplandor ambiental perimetral sutil opcional.
   */
  glow?: GlassGlow;
  /**
   * Etiqueta semántica HTML a renderizar (div, section, article, main, aside).
   */
  as?: ElementType;
  /**
   * Si es interactivo, añade micro-transición al hover para tarjetas cliqueables.
   */
  interactive?: boolean;
}

const INTENSITY_CLASS_MAP: Record<GlassIntensity, string> = {
  light: 'glass-card',
  ligero: 'glass-card',
  medium: 'glass-panel',
  medio: 'glass-panel',
  intense: 'glass-wet-effect',
  intenso: 'glass-wet-effect',
};

const GLOW_CLASS_MAP: Record<GlassGlow, string> = {
  none: '',
  brand: 'shadow-glow-brand',
  accent: 'shadow-glow-accent',
  'neon-cyan': 'shadow-glow-neon-cyan',
  'neon-purple': 'shadow-glow-neon-purple',
};

/**
 * Contenedor reutilizable de nivel Enterprise con efecto Wet Glassmorphism.
 * Proporciona translucidez profunda, desenfoque por hardware y reflejo especular superior.
 */
export default function GlassContainer({
  children,
  intensity = 'medium',
  glow = 'none',
  as: Component = 'div',
  interactive = false,
  className = '',
  ...rest
}: GlassContainerProps) {
  const intensityClass = INTENSITY_CLASS_MAP[intensity] ?? 'glass-panel';
  const glowClass = GLOW_CLASS_MAP[glow] ?? '';
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-white/25 hover:shadow-2xl transition-all duration-300'
    : '';

  const combinedClasses = [
    intensityClass,
    glowClass,
    interactiveClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={combinedClasses} {...rest}>
      {children}
    </Component>
  );
}

