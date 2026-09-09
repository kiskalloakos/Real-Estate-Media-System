export function passwordResetRedirectUrl() {
  if (process.env.EXPO_OS !== 'web') return 'agencyworkspace://reset-password';
  return typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
}
