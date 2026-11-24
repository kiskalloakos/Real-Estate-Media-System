import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Prepare SQL only; applying it remains a separate, explicitly scoped backend release.
export function buildMigrationRelease(filename, source) {
  const match = basename(filename).match(/^(\d{12,14})_([a-z0-9_]+)\.sql$/);
  if (!match) throw new Error('Use a versioned migration filename.');
  const tag = '$codex_migration_source$';
  if (source.includes(tag)) throw new Error('Migration source contains the reserved quoting delimiter.');
  const body = source.replace(/^begin;\s*/m, '').replace(/commit;\s*$/, '');
  // Concatenation preserves PostgreSQL $$ and JavaScript replacement metacharacters.
  return 'begin;\n' + body + '\ninsert into supabase_migrations.schema_migrations(version,name,statements) values (\''
    + match[1] + '\',\'' + match[2] + '\',ARRAY[' + tag + source + tag + ']);\ncommit;\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = process.argv[2];
  if (!filename) throw new Error('Usage: node scripts/build-migration-release.mjs <migration.sql>');
  process.stdout.write(buildMigrationRelease(filename, readFileSync(resolve(filename), 'utf8')));
}
