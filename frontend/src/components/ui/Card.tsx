import type { HTMLAttributes, PointerEvent } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'framer-motion';
import './card.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div';
  interactive?: boolean;
}

/** A visual surface, not a button. Nested controls retain their native behavior. */
export default function Card({ as: Tag = 'section', interactive = true, className = '', children, onPointerMove, onPointerLeave, ...props }: CardProps) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue('50%');
  const y = useMotionValue('50%');
  const light = useMotionTemplate`radial-gradient(360px circle at ${x} ${y}, var(--color-brand), transparent 75%)`;

  const moveLight = (event: PointerEvent<HTMLElement>) => {
    onPointerMove?.(event);
    if (event.defaultPrevented || !interactive || reduceMotion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(`${event.clientX - rect.left}px`);
    y.set(`${event.clientY - rect.top}px`);
  };

  return (
    <Tag {...props} className={`ui-card ${interactive ? 'ui-card--interactive' : ''} ${className}`.trim()}
      onPointerMove={moveLight} onPointerLeave={event => { onPointerLeave?.(event); x.set('50%'); y.set('50%'); }}>
      {interactive && <>
        <motion.span className="ui-card-light" style={{ background: light }} aria-hidden="true" />
        <motion.span className="ui-card-edge" style={{ background: light }} aria-hidden="true" />
      </>}
      {children}
    </Tag>
  );
}
