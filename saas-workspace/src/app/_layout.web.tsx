import '@/global.css';
import '@/workspace.css';
import '@/responsive.css';
import '@/dialogs.css';

import Head from 'expo-router/head';

import { RootLayout } from '@/providers/root-layout';

export default function WebRootLayout() {
  return (
    <>
      <Head>
        <title>Agency Workspace</title>
        <meta
          content="Manage property media production, reviews, schedules, and client agreements."
          name="description"
        />
      </Head>
      <RootLayout />
    </>
  );
}
