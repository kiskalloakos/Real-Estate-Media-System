# Agency Workspace

The production app at **https://app.realtymedia.ro** and the standalone agency SaaS foundation, with **web, iOS, and Android** support using Expo SDK 57 and React Native 0.86. See [production cutover](docs/production-cutover.md) for hosting, data continuity, release verification, and rollback. [Agency owners can sign up](docs/agency-signup.md) for a separate workspace; existing accounts continue using the existing backend.

## Local development

```sh
npm install
npm run web
```

Web runs on http://localhost:8091. Local `.env.local` currently configures Supabase, so ordinary startup may require login and can write to that configured backend. Do not assume it is sample mode. Never copy production secrets or use production records for UI tests.

For an isolated sample workspace on macOS/Linux:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL='' EXPO_PUBLIC_SUPABASE_ANON_KEY='' npm run web -- --clear
```

## Engagement projects (step 1)

Projects are client engagements or internal agency projects, backed by `jobs`.
One client can have multiple projects. Dates and contract/property links are
optional. Task sections have freely chosen names; no monthly sections are generated.
Pre-production, production and post-production are optional task attributes,
independent of the overall project status.

Existing property production history remains accessible under **Projects → Property
work**. Shared client/property records are not automatically assigned to a new
engagement; project tasks and events use an explicit `job_id`.

The backend migration is `supabase/migrations/202611240001_project_engagements.sql`.
It adds project contract/owner links, task sections, task phases, context constraints,
and section RLS. It does not rewrite existing records. Apply it through the normal
linked migration workflow as a separate backend release before releasing this UI.
Creating/editing projects is disabled when the section table is unavailable.

Applied to the existing Realty Media Supabase project on November 24, 2026,
before the frontend release. The dashboard SQL editor was used because the CLI
login-role endpoint denied access. The migration and its history entry were
committed together; historical migrations were not reapplied.

For an explicitly isolated development browser session, use the sample startup
command above with `--port 8092 --clear`, then open
`http://localhost:8092/?screen=projects&sample=1`. The development-only `sample=1`
guard disables Supabase on localhost even if Metro has a stale environment transform.
It cannot activate in a production export or on the hosted app. Project sample
changes stay in this browser's local storage.

Run `npm run test:projects` for project isolation, task metadata and route tests.
For the migration test, install `@electric-sql/pglite` into a temporary directory
outside the repository, then set `PROJECT_SQL_RUNTIME` to that package's
`dist/index.js` and run `npm run test:projects:db`. The test creates an isolated
PostgreSQL-compatible database with minimal foundation fixtures; it never uses
`.env.local` or connects to Supabase. It verifies the new constraints and section
policies, not all deployed application policies.

`supabase/tests/project-engagements.sql` also verifies the deployed schema with
fresh test agencies inside a rollback transaction. It checks real admin/tenant
policies and leaves no fixtures behind. Run the entire file, including its
`BEGIN` and `ROLLBACK`, against the migrated backend. This live check passed on
November 24, 2026.

## Expo Go on iOS and Android

```sh
npm run start:go
```

Keep the phone and computer on the same Wi-Fi. Scan the terminal QR code using the iPhone Camera or Expo Go on Android. Use an Expo Go version compatible with SDK 57. If Expo Go reports an incompatible SDK, install a compatible version where available or use a development build; clearing Metro cannot fix a native SDK mismatch.

The previous default `expo start` selected a development build because `expo-dev-client` is installed. That QR code targets a custom installed app, which can explain why it did not open in Expo Go. `npm start`, `npm run ios`, and `npm run android` now explicitly use `--go`. The localhost-only web command is not a phone launch command.

If LAN access fails (guest Wi-Fi, firewall, or VPN), try:

```sh
npm run start:go:tunnel
```

The tunnel option needs network access and Expo's tunnel dependency. Stop old Metro sessions and scan the newly generated QR code. For an offline sample backend, prefix the command with the same environment overrides shown above.

Remote push registration is disabled in Expo Go. Test remote notifications and custom native configuration in an installed development build using `npm run start:dev-client`. `eas.json` has a development profile for both platforms. This project already has its own EAS project ID in `app.json`, different from the sibling production app; no build or deployment was started during this review.

Both `ios.bundleIdentifier` and `android.package` are `ro.realtymedia.workspace`; the URL scheme is `agencyworkspace`. Native documents and tasks already have read-only detail routes. Web now opens previews before an explicit Edit action. Images/PDFs have embedded document previews; other attached formats open through their file viewer.

References: [Expo CLI launch targets](https://docs.expo.dev/more/expo-cli/), [device connectivity](https://docs.expo.dev/get-started/start-developing/), [SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).

## Verification

```sh
npm run typecheck
npm run build:web
npm run build:ios
npm run build:android
npx expo install --check
```

September 9, 2026: TypeScript, web export, and combined iOS/Android bundle export passed. Dependency compatibility passed against the installed SDK's offline dependency map; online validation was unavailable. Bundle exports verify compilation, not successful installation or physical-device startup. Expo Go device testing remains pending. Browser checks confirmed task preview → Edit, compact task layout, and transparent client names. The isolated sample workspace has no document/folder fixtures, so populated document previews and folder hover were checked in code but not exercised in the browser.

Phone smoke test: launch on both platforms; open tasks and documents; return to the list; test keyboard, attachments, login/session restore, and logout against a test agency. Verify push separately in a development build.

## Security review status

The supplied [security requirements document](https://docs.google.com/document/d/17eGzIAs2Dze2BBxaItS7pdLHH7WaTMVxFM_QGko5b74/edit) was inaccessible to the connected Google account (404); the browser also reports that `akos@famescale.co` needs access. Requirements compliance cannot be claimed until it is shared or its contents are provided.

Local inspection found native sessions use Expo SecureStore, service-role credentials are read in server functions, and the retained migrations define row-level security and storage policies. Four social integration functions disable gateway JWT verification; they contain application-level authentication helpers and OAuth state handling, which need endpoint-level review before release. These are source observations, not a live security audit. Deployed policies, tenant isolation, storage access, and server secrets were not verified or changed.

Document HTML previews use a sandboxed iframe with scripts disabled and a restrictive content policy. Module visibility and UI permission checks are not substitutes for database authorization.

## Production hosting

Vercel's existing `famescale/realty-media-app` project builds this repository's `saas-workspace` directory from `main`. Sibling `../webapp` remains the legacy source. Production Supabase variables, database, storage, and server functions are retained; no records need moving. The native EAS project remains separate. Local environment files are ignored by Git. Do not put server secrets in `EXPO_PUBLIC_*` variables because those are shipped to clients.
