# Workspace onboarding

New owner registrations include `workspace_onboarding_version: 1` in Auth user
metadata. After email verification and membership hydration, the web workspace
shows setup only when the signed-in administrator is the agency's `created_by`
user and setup has not been completed. This flag controls presentation only;
existing database policies continue to authorize every read and write.

Accounts registered before this feature continue directly to their workspace.
Administrators can open the same flow from **Customize workspace → Set up
workspace**. Invited team members and clients receive a dismissible welcome,
with no agency setup or agency creation.

Setup has two steps:

1. Confirm the agency name collected at signup, optionally upload a logo, and
   choose timezone and currency. Continue saves these details and step 2.
2. Choose Production studio, Content agency, or Just the essentials. Selection is
   saved immediately. Enter workspace saves the tools and completion timestamp
   before opening the dashboard. Back persists step 1.

Failed saves retain the form and allow retry. No invitations, business records,
sample data, billing changes, or agencies are created by setup.

## Persistence and identity

The existing `agencies` row stores name, logo path, timezone, and currency.
Its existing `settings` JSON stores:

```json
{
  "workspace": {
    "enabledModules": ["tasks", "clients", "calendar", "documents"],
    "onboarding": {
      "version": 1,
      "step": 2,
      "preset": "essentials",
      "completedAt": "2026-11-24T12:00:00.000Z",
      "checklistDismissed": false
    }
  }
}
```

Settings writes read the latest row, merge the workspace/onboarding namespaces,
and use `updated_at` to reject concurrent overwrites. Workspace settings use this
same save path, preserving onboarding progress and unrelated settings. No
migration or server-function deployment is required.

Agency members see the saved agency name and signed logo URL in the sidebar;
missing or failed images fall back to initials. The duplicate workspace subtitle
and default Realty Media identity are removed. Client users retain their existing
restricted database access: when agency branding is not available through that
access, their shell uses neutral “Your workspace” text.

Sidebar mode and tool order remain browser preferences, scoped by agency ID and
user ID. Previous browser preferences are read as a fallback. Renaming an agency
does not change the storage key. Welcome dismissal is also personal to the
browser. Setup progress, enabled tools, and checklist dismissal are agency data
and survive changing browsers.

The checklist derives completion from actual clients, team memberships, and
tasks/calendar events. It waits for portal data to load and supports dismissal.

## Verification

```sh
node --test scripts/workspace-onboarding.test.cjs
npm run typecheck
npm run build:web
npx expo export --platform ios --output-dir /private/tmp/realty-onboarding-ios
```

For a browser-only sample, export a static build with no backend configured:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL='' EXPO_PUBLIC_SUPABASE_ANON_KEY='' \
  npx expo export --platform web --output-dir /private/tmp/realty-onboarding-preview
```

Serve that output locally with extensionless HTML fallback and use **Customize
workspace → Set up workspace**. Verify the resulting sample bundle contains no
live backend URL before making test changes. Expo SDK 57 development bundles can
load `.env.local` through their virtual environment module even when shell
variables are empty; do not rely on that development command for isolated writes.
Sample builds must never be deployed.
