# realty media architecture

## Product targets

- iOS is the primary native product and intentionally remains a light companion.
- Web is the complete administrative and client workspace.
- Android is outside the current scope.
- macOS requires no separate implementation for MVP. The compatible iOS build may be
  offered to Apple-silicon Mac users in App Store Connect; the responsive web app is
  the guaranteed desktop experience.

## Source layout

- `src/app/`: Expo Router route files and native navigation configuration.
- `src/screens/native/`: light iOS screen bodies.
- `src/screens/web/`: role-aware web workspace bodies.
- `src/components/native/` and `src/components/web/`: platform-specific presentation.
- `src/providers/`: authentication, role, and query state.
- `src/lib/`: Supabase and feature adapters.
- `src/types/`: generated and domain database types.
- `src/theme/`: brand and platform tokens.
- `supabase/migrations/`: versioned database schema and security policies.

## Security model

Every business row is scoped to an agency. realty media is the only agency in this
deployment. Client-owned records also carry a client account, and production records
carry property ownership/assignment as appropriate.

- Admins have agency-wide access.
- Team members are restricted to explicitly assigned properties.
- Clients are restricted to their own active client memberships.
- Storage paths and policies mirror the same boundaries.
- Service-role credentials and social-provider tokens never enter an Expo bundle.
- A public publishable key is expected in the client; Row Level Security is the enforcement
  boundary.

## Deployment model

The canonical repository can support either future:

1. Provision a separate Supabase/Vercel deployment per agency from the same tagged
   release—preferred for a small number of bespoke customers.
2. Promote the existing agency boundary into a hosted multi-tenant product if the
   offering becomes standardized and self-service.

Customer forks should not become independent sources of truth. Versioned migrations
and releases keep dedicated deployments aligned.

## Social analytics boundary

FameScale remains a reference implementation, not a runtime dependency. realty media
uses the existing FameScale-approved social apps and reviewed permissions, but has
separate OAuth callbacks, encrypted tokens, database models, and synchronization
pipelines.

- Only active realty media admins and active members of the target client account can
  begin Facebook/TikTok Login, refresh, or disconnect a social account.
- Team members have no database or UI access to Instagram/TikTok connections or analytics.
- Provider access and refresh tokens live in Supabase Vault and are available only
  to service-role database functions.
- Web manages connections and shows 7/30/90-day analytics. iOS is read-only.
- A scheduled database job requests due syncs every 15 minutes; each connection moves
  its own next-sync time six hours forward after success.
- The MVP is client-account-level. Property cards may summarize their owning client's
  connected accounts, but the system does not claim post-to-property attribution.
- Publishing, FameScale billing, FameScale custom auth, and FameScale database
  coupling are outside this integration.
