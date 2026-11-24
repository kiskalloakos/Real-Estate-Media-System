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

## Automatic task handoffs (step 2)

In a project's task editor, an agency admin can choose **Waits for task** and
assign the task to its next owner. Each task can wait for one preceding task in
the same project, across any work sections. Several tasks can follow the same
preceding task. No task templates are generated.

Completing the preceding task makes the following work ready and sends its
assigned person a **Task ready** notification. Clicking the notification opens
that task. Work is not marked in progress automatically. Waiting tasks cannot
be started or completed until their preceding task is complete. Reopening or
archiving the preceding task resets readiness; it does not undo work already
started. Repeated saves do not duplicate the same completion alert.

The separate backend migration is `202611240002_task_handoffs.sql`, applied and
recorded on November 24, 2026 before its frontend release. It leaves existing
tasks independent. Links, cycle checks, readiness, and notification delivery
are enforced by the database, including for native/direct API callers.
Notifications respect active membership and task visibility, and never include
private preceding-task details. Existing notification/push preferences apply.

`npm run test:projects` covers handoff UI rules and notification filtering.
`npm run test:projects:db` also exercises handoff constraints and deduplication
in the isolated PostgreSQL runtime described above.
`supabase/tests/task-handoffs.sql` tests the deployed schema with a private
preceding task, a separate editor, and another agency; its entire transaction
rolls back. This live-permissions test passed on November 24, 2026.

## Versioned client reviews (step 3)

Clients sign in with their existing account. Each engagement has a **Reviews**
tab; the global review room can filter by engagement or legacy property work.
Uploads support videos, photos, scripts and documents, including engagements
without a property. Upload multiple new files together or use **Upload revision**
to add a version to an existing item. New versions reopen review and preserve
previous files, feedback and decisions.

Clients can approve one displayed version or select items from one collection
and approve a batch. The confirmation lists the exact versions. The database
locks decisions against uploads, rejects stale targets, and commits a batch
atomically. Previous-version feedback remains accessible; decisions require
the latest version. Native comments and decisions also send explicit version IDs.

Feedback supports video timestamps, replies, resolved comments, and team-only
notes. Client access and notification recipients exclude internal notes and
private files. Alerts open the relevant review/version. Archiving retains the
files and history. Existing property-based review paths remain supported.

Backend migration `202611240003_versioned_reviews.sql` was applied separately on
November 24, 2026, before the frontend release. It derives existing assets'
client IDs from their properties and preserves the private `media-review`
bucket. The three November 24 migration-history source copies were verified
against the repository after correcting dollar-quote escaping in the stored
copies; the applied database functions were unaffected.

When preparing a separately authorized SQL-editor release, use
`node scripts/build-migration-release.mjs supabase/migrations/<migration.sql>`.
It prints transactional SQL with an exact source copy in migration history;
it does not connect to or modify a database. Do not reapply historical migrations.

Run `npm run test:reviews`, and use `PROJECT_SQL_RUNTIME` as described above for
`npm run test:reviews:db`. The isolated database test exercises real PostgreSQL
RLS and the retained review schema. The deployed-schema check is
`supabase/tests/versioned-reviews.sql`; run the complete rollback transaction.
It creates fresh test agencies/users and temporary review/storage metadata,
then rolls all fixtures back. Browser upload/revision checks used the isolated
local sample; no real client files were uploaded or approved for these tests.

## Project writing pages (step 4)

Each engagement now has a **Pages** tab. **Documents → Project pages** collects
pages across engagements. Create document or script pages, nest them under other
pages in the same project, search their text, move pages, and open direct page
links. Existing agency files remain under **Company library**; the existing
screenplay, shot planning and PDF tools remain under **Production scripts**.

Pages start **team-only**. Agency admins and active team members can edit them.
**Share with client** grants the project's signed-in client read access to that
page only. Sharing never propagates to children. Internal project pages cannot
be shared. Clients see neither private parent titles nor earlier revision
history. Projects with pages cannot switch clients and expose writing to a new
client accidentally.

The web editor supports text, headings, lists, checklists, quotes, callouts,
code, dividers, and script scene/action/character/dialogue blocks. Use the block
type selector or type `/`; reorder blocks with the arrow controls. Saves run
after a short pause, and **Save now** is also available. Each successful save
creates a revision. **History** previews the latest 50 revisions and restores
text as a new revision, retaining the current sharing and parent settings.
**Export text** downloads the current draft.

Saving uses an expected revision and a database lock; simultaneous edits reject
stale saves instead of merging text. This is conflict detection, not live
co-editing. Failed drafts stay in the editor and in browser recovery storage,
scoped to the agency, user and page. Users can retry, download their draft, or
explicitly reload saved content. Existing company-library documents keep their
current editing flow; they are not converted or made client-visible.

Backend migration `202611240004_project_pages.sql` was applied separately on
November 24, 2026. It adds two RLS-protected tables and a checked save RPC;
existing files, buckets and Edge Functions are unchanged. Run `npm run test:pages`
and `PROJECT_SQL_RUNTIME=<isolated PGlite module> npm run test:pages:db` for the
service/navigation helpers and migration checks. `supabase/tests/project-pages.sql`
tests the actual deployed schema in one rollback transaction using fresh test
agencies and identities. Interactive browser editing checks use the isolated
local preview. Production browser verification is read-only. The new page
editor is a web feature; iOS export checks native compatibility.

## Calendar categories and client requests (step 5)

Calendar events now support a **Call** category alongside Shoot, Review,
Deadline and Internal. Set it when creating or editing an event, and use the
category selector to filter the calendar. Existing event metadata remains
compatible with web and native views.

Signed-in clients can open **Calendar → Request a booking**, propose a call or
shoot, and see their request status. Agency owners confirm or decline requests
in the same Calendar view. Confirmation creates one client-visible calendar
event, assigns the confirming owner, and rejects overlaps with existing agency
calendar events. Retrying the same submission or confirmation is idempotent.
Clients cannot approve requests or access another client's requests. Requests
remain separate from calendar events until confirmed.

The existing Google Calendar action creates an add-event link; Apple Calendar
exports an ICS file. These are retained exports, not automatic two-way sync or
provider availability checks. Client requests therefore require agency approval,
as authorized for this step. No public booking links, recurring availability
rules, external calendar integration changes or new task templates were added.

Migration `202611240005_calendar_requests.sql` is a separate backend release.
`PROJECT_SQL_RUNTIME=<isolated PGlite module> npm run test:calendar:db` checks
permissions, duplicates, confirmation, conflict rejection and persisted category.
`supabase/tests/calendar-bookings.sql` exercises the actual schema with fresh
identities and agencies in a rollback transaction. Browser request/confirmation
checks use the isolated local preview; production verification is read-only.

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
