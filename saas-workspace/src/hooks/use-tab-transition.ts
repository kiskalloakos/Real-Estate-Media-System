import { useEffect, useRef } from 'react';

import { webTheme } from '@/theme/web';

/** Animate a changed view without remounting its forms, selection, or scroll state. */
export function useTabTransition<T extends HTMLElement = HTMLDivElement>(key: string | number) {
  const ref = useRef<T>(null);
  const previousKey = useRef(key);

  useEffect(() => {
    const changed = previousKey.current !== key;
    previousKey.current = key;
    const element = ref.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!changed || !element || reducedMotion.matches) return;

    const animation = element.animate([{ opacity: 0.6 }, { opacity: 1 }], {
      duration: webTheme.motion.standard,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    const stop = () => animation.cancel();
    reducedMotion.addEventListener('change', stop);
    return () => {
      animation.cancel();
      reducedMotion.removeEventListener('change', stop);
    };
  }, [key]);

  return ref;
}
