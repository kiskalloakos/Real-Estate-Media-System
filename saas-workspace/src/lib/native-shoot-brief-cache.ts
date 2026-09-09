import * as FileSystem from 'expo-file-system/legacy';

import type { PortalData } from '@/screens/web/types';

type ShootBriefCache = Pick<
  PortalData,
  'calendarEvents' | 'companyDocuments' | 'properties' | 'tasks'
>;

function cachePath(userId: string, agencyId: string) {
  const safe = `${userId}-${agencyId}`.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${FileSystem.documentDirectory}realty-media-shoot-briefs-${safe}.json`;
}

function compact(data: PortalData): ShootBriefCache {
  return {
    calendarEvents: data.calendarEvents ?? [],
    companyDocuments: (data.companyDocuments ?? [])
      .filter((document) => document.kind === 'sop' || /brief|shoot|production/i.test(document.title))
      .map((document) => ({ ...document, contentHtml: document.contentHtml?.slice(0, 20_000) ?? '' })),
    properties: data.properties ?? [],
    tasks: (data.tasks ?? []).filter((task) => task.status !== 'done' && task.status !== 'cancelled'),
  };
}

export async function loadNativeShootBriefCache(userId: string, agencyId: string) {
  if (process.env.EXPO_OS === 'web' || !FileSystem.documentDirectory) return null;
  try {
    const serialized = await FileSystem.readAsStringAsync(cachePath(userId, agencyId));
    return JSON.parse(serialized) as ShootBriefCache;
  } catch {
    return null;
  }
}

export async function saveNativeShootBriefCache(
  userId: string,
  agencyId: string,
  data: PortalData,
) {
  if (process.env.EXPO_OS === 'web' || !FileSystem.documentDirectory) return;
  try {
    await FileSystem.writeAsStringAsync(
      cachePath(userId, agencyId),
      JSON.stringify(compact(data)),
    );
  } catch {
    // Offline reading is a convenience. Live data remains authoritative.
  }
}
