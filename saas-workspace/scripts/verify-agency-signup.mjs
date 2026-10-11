import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

// All fixtures and any not-yet-applied migration are rolled back together.
// Credentials stay in subprocess environment variables, never command arguments.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const envFile = args.includes('--env-file') ? option('--env-file') : null;
const config = { ...(envFile ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {}), ...process.env };
const publicUrl = config.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = config.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!publicUrl || !publicKey) throw new Error('Supply the app public Supabase URL/key to verify Auth configuration.');
const settingsResponse = await fetch(`${publicUrl.replace(/\/$/, '')}/auth/v1/settings`, {
  headers: { apikey: publicKey },
  signal: AbortSignal.timeout(10_000),
});
if (!settingsResponse.ok) throw new Error('Could not verify Supabase Auth signup settings.');
const settings = await settingsResponse.json();
if (settings.mailer_autoconfirm !== false || settings.disable_signup !== false || settings.external?.email !== true) {
  throw new Error('Owner signup requires email signup enabled and mandatory email confirmation.');
}
const connectionString = config.SUPABASE_POOLER_URL || config.SUPABASE_DB_URL;
if (!connectionString) throw new Error('Set SUPABASE_POOLER_URL or SUPABASE_DB_URL, or supply --env-file.');
const connection = new URL(connectionString);
const sslRoot = args.includes('--ssl-root-cert') ? option('--ssl-root-cert') : config.PGSSLROOTCERT;
if (!sslRoot) throw new Error('Supply --ssl-root-cert with the Supabase CA certificate.');
const binary = config.PSQL_BINARY || 'psql';
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202610110001_agency_owner_signup.sql'), 'utf8');
const tests = fs.readFileSync(path.join(root, 'supabase/tests/agency-owner-signup.sql'), 'utf8');
const sql = String.raw`BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT to_regclass('public.agency_owner_signups') IS NULL AS needs_migration \gset
\if :needs_migration
${migration}
\endif
${tests}
ROLLBACK;
`;
const result = spawnSync(binary, ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], {
  input: sql,
  encoding: 'utf8',
  env: {
    ...process.env,
    PGHOST: connection.hostname,
    PGPORT: connection.port || '5432',
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: connection.pathname.slice(1) || 'postgres',
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: sslRoot,
    PGCONNECT_TIMEOUT: '10',
  },
});
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status || 1);
}
console.log('Auth configuration, agency signup, invitations, and tenant isolation checks passed. All test changes rolled back.');
