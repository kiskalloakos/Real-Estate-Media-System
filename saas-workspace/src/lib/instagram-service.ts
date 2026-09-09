import {
  beginSocialConnection,
  disconnectSocialConnection,
  syncSocialAccount,
} from '@/lib/social-service';

export function beginInstagramConnection(
  input:
    | { scope: 'agency' }
    | { clientAccountId: string; scope: 'client' },
) {
  return beginSocialConnection('instagram', input);
}

export function disconnectInstagramConnection(connectionId: string) {
  return disconnectSocialConnection('instagram', connectionId);
}

export function syncInstagramAccount(connectionId: string) {
  return syncSocialAccount('instagram', connectionId);
}
