import Button from '../../components/ui/Button';
import { ArrowUpRight, Boxes, BrainCircuit, ShieldCheck } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import type { PointerEvent } from 'react';
import sentinelLogo from '../../assets/sentinel-logo.png';
import type { Tab } from '../../components/layout/navigation';
import './dashboard.css';

export default function DashboardHero({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 45, damping: 22 });
  const y = useSpring(pointerY, { stiffness: 45, damping: 22 });
  const moveLight = (event: PointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 70);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 40);
  };
  return (
    <section className="dashboard-hero glass max-h-[40vh]" aria-labelledby="dashboard-hero-title" onPointerMove={moveLight} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
      <div className="hero-grid" aria-hidden="true" />
      <motion.div className="hero-aurora" aria-hidden="true" style={{ x: reduceMotion ? 0 : x, y: reduceMotion ? 0 : y }} />
      <div className="hero-copy">
        <p className="hero-kicker"><span />INTELIGENCIA PREVENTIVA</p>
        <h2 id="dashboard-hero-title">Anticipa el riesgo.<br /><span>Controla cada operación.</span></h2>
        <p className="hero-description">Analiza operaciones con IA y aplica tus políticas de seguridad para tomar decisiones con contexto.</p>
        <div className="hero-actions">
          <Button variant="primary" pulse type="button" onClick={() => onNavigate('operaciones')}>Analizar operación<ArrowUpRight size={17} aria-hidden="true" /></Button>
          <Button variant="secondary" type="button" onClick={() => onNavigate('policies')}>Gestionar políticas</Button>
        </div>
      </div>
      <div className="hero-diagram" aria-label="Flujo conceptual: operación, análisis de IA y políticas de seguridad">
        <div className="hero-orbit hero-orbit-outer" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-inner" aria-hidden="true" />
        <div className="hero-core" aria-label="Núcleo Sentinel">
          <img src={sentinelLogo} alt="Logo Sentinel" className="hero-core-logo" width={44} height={44} />
          <span>SENTINEL</span>
        </div>
        <div className="hero-node hero-node-input"><Boxes size={16} aria-hidden="true" /><span>Operación</span></div>
        <div className="hero-node hero-node-ai"><BrainCircuit size={16} aria-hidden="true" /><span>Análisis IA</span></div>
        <div className="hero-node hero-node-policy"><ShieldCheck size={16} aria-hidden="true" /><span>Políticas</span></div>
        <span className="hero-diagram-caption">ARQUITECTURA DE PROTECCIÓN</span>
      </div>
    </section>
  );
}
