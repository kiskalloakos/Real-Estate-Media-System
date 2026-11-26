import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PortalScreenKey } from '@/components/web/PortalShell';
import { portalLocationUrl, readPortalLocation, type PortalLocation } from '@/lib/portal-location';

/** Browser history carries record selection and filters; each entry retains its scroll position. */
export function usePortalLocation(fallback: PortalScreenKey, allowed: readonly PortalScreenKey[], workspaceId: string) {
  const [location, setLocation] = useState<PortalLocation>(() => typeof window === 'undefined'
    ? { screen: fallback } : readPortalLocation(window.location.search, fallback, allowed));
  const restore = useRef(0);
  const pathname = useRef(typeof window === 'undefined' ? '/' : window.location.pathname);
  const saveScroll = useCallback(() => {
    const scroll = document.querySelector<HTMLElement>('.aw-frame')?.scrollTop ?? window.scrollY;
    window.history.replaceState({ ...window.history.state, rmPortal: true, rmScroll: scroll }, '', window.location.href);
  }, []);
  const visit = useCallback((next: PortalLocation, replace = false) => {
    if (!allowed.includes(next.screen)) return;
    saveScroll();
    const url = portalLocationUrl(window.location.href, next);
    const inProject = next.screen === 'projects' || next.screen === 'clients';
    const sameCanvas = next.screen === location.screen && next.pageId === location.pageId
      && (!inProject || (
        next.clientId === location.clientId
        && next.projectId === location.projectId
        && (next.projectSection ?? 'Overview') === (location.projectSection ?? 'Overview')
      ));
    restore.current = sameCanvas ? document.querySelector<HTMLElement>('.aw-frame')?.scrollTop ?? 0 : 0;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      const state = { ...window.history.state, rmPortal: true, rmScroll: restore.current };
      if (replace) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);
    }
    setLocation(next);
  }, [allowed, location.screen, location.clientId, location.projectId, location.projectSection, location.pageId, saveScroll]);
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, rmPortal: true }, '', portalLocationUrl(window.location.href, location));
  }, [location]);
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      if (!event.state?.rmPortal || window.location.pathname !== pathname.current) return;
      // Query-only workspace entries must not remount Expo's whole navigation stack.
      event.stopImmediatePropagation();
      restore.current = typeof event.state?.rmScroll === 'number' ? event.state.rmScroll : 0;
      setLocation(readPortalLocation(window.location.search, fallback, allowed));
    };
    const frame = document.querySelector('.aw-frame');
    let scrollTimer: ReturnType<typeof setTimeout>;
    const rememberScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(saveScroll, 150);
    };
    window.addEventListener('popstate', pop, true);
    frame?.addEventListener('scroll', rememberScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('popstate', pop, true);
      frame?.removeEventListener('scroll', rememberScroll);
    };
  }, [allowed, fallback, saveScroll]);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.aw-frame')?.scrollTo({ top: restore.current, left: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location, workspaceId]);
  return [location, visit] as const;
}
