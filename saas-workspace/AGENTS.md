# Agency Workspace — isolated SaaS copy

Work only in this folder for the SaaS experiment. The sibling ../webapp is production.
Never deploy this app to app.realtymedia.ro or reuse production Vercel/EAS project IDs.
Do not push database migrations during UI work. Preview mode is the default; do not copy production secrets.
A future Vercel project must use this directory and its own project/domain. No deployment is requested yet.
Start locally: npx expo start --web --localhost --port 8091.
Validate with npm run typecheck, npm run build:web, and npx expo export --platform ios for native changes.
Design: original Outfit font, charcoal navigation, neutral gray canvas, white panels, original Realty Media blue #5256E0. FameScale-style expanded/collapsed/hover sidebar.
The inherited README and design rules describe the old app; docs/saas-foundation.md supersedes them for this copy.
Expo SDK 57 documentation: https://docs.expo.dev/versions/v57.0.0/ .
