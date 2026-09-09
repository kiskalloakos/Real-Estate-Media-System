import {
  beginSocialConnection,
  disconnectSocialConnection,
  syncSocialAccount,
} from '@/lib/social-service';

export function beginTikTokConnection(
  input:
    | { scope: 'agency' }
    | { clientAccountId: string; scope: 'client' },
) {
  return beginSocialConnection('tiktok', input);
}

export function disconnectTikTokConnection(connectionId: string) {
  return disconnectSocialConnection('tiktok', connectionId);
}

export function syncTikTokAccount(connectionId: string) {
  return syncSocialAccount('tiktok', connectionId);
}
