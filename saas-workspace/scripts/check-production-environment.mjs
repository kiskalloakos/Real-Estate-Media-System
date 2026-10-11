// Hosting must fail closed instead of publishing the sample workspace.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before deploying.');
}
if (new URL(url).protocol !== 'https:') {
  throw new Error('The deployed Supabase URL must use HTTPS.');
}
if (key.startsWith('sb_secret_')) {
  throw new Error('A server secret must never be exported to the browser. Use the publishable key.');
}
if (key.startsWith('eyJ')) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (payload.role !== 'anon') {
    throw new Error('Use the public anon key, never a service-role or user-session key.');
  }
}
console.log('Public Supabase build configuration is present.');
