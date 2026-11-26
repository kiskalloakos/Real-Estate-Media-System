import '@/global.css';
import '@/workspace.css';
import '@/responsive.css';
import '@/dialogs.css';
import '@/workspace-refinements.css';
import '@/studio.css';
import '@/workspace-dark.css';
import '@/workspace-radii.css';
import '@/workspace-interactions.css';
import '@/workspace-mobile.css';
import '@/workspace-motion.css';

import Head from 'expo-router/head';
import { useEffect } from 'react';

import { RootLayout } from '@/providers/root-layout';
import { WorkspaceLoading } from '@/components/web/WorkspaceLoading';

export default function WebRootLayout() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let layoutHeight = window.innerHeight;
    let layoutWidth = window.innerWidth;
    const resize = () => {
      const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,[contenteditable=true]');
      if (!editing || layoutWidth !== window.innerWidth) layoutHeight = window.innerHeight;
      layoutWidth = window.innerWidth;
      const unzoomed = viewport.scale === 1;
      root.style.setProperty('--aw-visual-height', `${unzoomed ? viewport.height : window.innerHeight}px`);
      root.style.setProperty('--aw-visual-top', `${unzoomed ? viewport.offsetTop : 0}px`);
      root.dataset.awKeyboardOpen = String(Boolean(editing && unzoomed && layoutHeight - viewport.height > 150));
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    document.addEventListener('focusin', resize);
    document.addEventListener('focusout', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
      document.removeEventListener('focusin', resize);
      document.removeEventListener('focusout', resize);
      root.style.removeProperty('--aw-visual-height');
      root.style.removeProperty('--aw-visual-top');
      delete root.dataset.awKeyboardOpen;
    };
  }, []);

  return (
    <>
      <Head>
        <title>Agency Workspace</title>
        <meta
          content="Manage property media production, reviews, schedules, and client agreements."
          name="description"
        />
      </Head>
      <RootLayout loadingFallback={<WorkspaceLoading />} />
    </>
  );
}
