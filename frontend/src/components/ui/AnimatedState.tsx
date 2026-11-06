import type { ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';

function StatePanel({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reduceMotion = useReducedMotion();
  return (
    <motion.div inert={!present} aria-hidden={!present || undefined}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}>
      {children}
    </motion.div>
  );
}

/** Animate only the async content, keeping forms and filters mounted. */
export default function AnimatedState({ stateKey, children }: { stateKey: string; children: ReactNode }) {
  return <AnimatePresence mode="wait" initial={false}><StatePanel key={stateKey}>{children}</StatePanel></AnimatePresence>;
}
