# Agency Workspace — production web app

This folder serves https://app.realtymedia.ro and is the standalone agency SaaS
foundation. The user promoted it from an experiment on October 11, 2026.
Keep ../webapp intact as the legacy app, including its separate Git repository
and local changes. Never deploy that folder to the production app domain.

Keep the existing Realty Media Supabase project, public build variables,
session storage defaults, storage buckets, and deployed Edge Functions.
No database migrations or server function deployments are part of UI releases.
Never put server secrets in EXPO_PUBLIC_* variables. Test writes with a test agency.

Vercel project: famescale/realty-media-app (prj_Ki03M9osqnqHacF7igUWUKsmblHV).
Git source: kiskalloakos/Real-Estate-Media-System, main, root saas-workspace.
Validate with npm run typecheck and npm run build:web. Fetch origin/main and
incorporate updates, commit only intended changes, and fast-forward push to main.
Never force-push. Verify the Ready Git deployment for that commit using
npm run release:verify -- <ready-deployment-url>; add --repair if the alias is stale.
See docs/production-cutover.md for rollback. Keep the native EAS project separate.

Local .env.local connects to the live backend. For sample UI work, prefix the
start command with EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=''
EXPO_PUBLIC_SUPABASE_ANON_KEY=''. Sample mode must never be deployed.
Start locally: npx expo start --web --localhost --port 8091.
Validate with npm run typecheck, npm run build:web, and npx expo export --platform ios for native changes.
Design: original Outfit font, charcoal navigation, neutral gray canvas, white panels, original Realty Media blue #5256E0. FameScale-style expanded/collapsed/hover sidebar.
README.md and docs/production-cutover.md govern hosting; docs/saas-foundation.md records historical design iterations.
Expo SDK 57 documentation: https://docs.expo.dev/versions/v57.0.0/ .
