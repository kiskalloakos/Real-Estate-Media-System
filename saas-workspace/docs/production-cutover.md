# Production app cutover — October 11, 2026

`app.realtymedia.ro` serves this repository's `saas-workspace` app at `/`.
The source folder name is not a URL prefix.

## Release configuration

- Vercel team: `famescale` (`team_6jEnYrlpDWiLMkHBDJkWK89n`).
- Existing project: `realty-media-app` (`prj_Ki03M9osqnqHacF7igUWUKsmblHV`).
- Git repository: `kiskalloakos/Real-Estate-Media-System`, production branch `main`.
- Project root: `saas-workspace`; build/output: this folder's `vercel.json` and `dist`.
- Retain the existing project's production public Supabase variables.
- Keep sibling `webapp`, its separate `realty-media-app` Git repository, and all
  local changes intact. It no longer supplies production releases.
- Public agency signup is deferred. Existing users continue signing in normally.

## Data compatibility

Both apps use identical Supabase public URL/key settings and browser auth storage
defaults. The domain stays the same, so existing sessions can be restored.
Existing accounts, memberships, files, records, and deployed functions remain
in the existing backend. Password reset and social OAuth callbacks retain the
same web origin. No data copy or database migration is part of this cutover.

The workspace scopes queries to the signed-in user's agency and restores
memberships from the existing tables. The optional jobs query tolerates an
uninstalled jobs table; creating jobs requires that module's migration separately.
Database policies remain authoritative. Public signup and a tenant security
audit are separate work before opening self-service registration.

## Verification and rollback

Run `npm run typecheck`, `npm run build:web`, and
`npm run release:verify -- <ready-main-deployment-url>` from this folder.
The verifier checks that the live domain targets the expected Ready deployment
and serves the new workspace CSS, rather than just any Expo app.

Before cutover the domain served `realty-media-8shaz9wi5-famescale.vercel.app`
(`dpl_6iYKjWsoQwkVAEQoKJV71zs9PBoe`). Retain it for emergency frontend rollback:

```sh
vercel alias set realty-media-8shaz9wi5-famescale.vercel.app app.realtymedia.ro --scope famescale
```

For a longer rollback, also restore the Git connection to
`kiskalloakos/realty-media-app` and the project root to `null` (repository root).
An alias-only rollback does not change what future `main` pushes deploy.
