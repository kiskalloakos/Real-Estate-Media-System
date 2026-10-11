# SaaS foundation — first implementation

Historical notes: this document records isolated development iterations.
On October 11, 2026 the user requested promoting this app to production.
[Production cutover](production-cutover.md), README.md, and AGENTS.md supersede
the historical isolation and hosting directions below.

## Direction

Productivity for real estate content and marketing agencies. The chosen visual direction is light studio: warm neutral surfaces, readable charcoal text, a restrained green accent, a labeled sidebar, and more breathing room. Agency Workspace is a working name, not a finalized brand.

## This iteration

- Full application source copied into this standalone folder.
- New responsive web shell with search, notifications, and role-aware navigation.
- Owner home showing existing tasks, reviews, properties, and schedule data. Sample data is labeled.
- Module registry: tasks, clients/properties, calendar, reviews, documents, team, marketing, sales, gear, finances, scripts.
- Owners can change workspace name, toggle module visibility, reorder navigation, and apply production/content/essential starter setups.
- Preferences are personal, per-browser layout settings scoped to the current organization label and user. They are not agency-wide entitlements. Existing permissions and data remain authoritative; hidden modules can still be reached by contextual links.
- Search page entries follow enabled modules. Home cards follow enabled modules.
- Existing feature screens retain their service adapters. Shared page headings, controls, task cards, and colors have received a visual pass; individual modules have not all been redesigned.
- iOS shares the new palette and has its own bundle ID/scheme, but retains its existing native navigation. Native module customization and synchronization across devices are follow-up work.
- Production release tooling and identifiers were removed from the copy. No deployment or database change.

## Database

No credentials are configured in this copy. Its current review mode cannot write production records. The schema and service integrations are retained to allow using the same Supabase project later. To reconnect, configure the public Supabase URL/key and separate OAuth/reset callback origins for the new host. Doing so reconnects ordinary mutations to live records; use a test agency before exercising writes. Server functions are not deployed by the web export.

## Next slices

1. Review the visual direction and module grouping with the owner.
2. Persist agency settings by actual agency ID, with owner permission checks and native support. Keep personal ordering separate from agency-enabled features.
3. Introduce package/job templates and recurring deliverable workflows.
4. Redesign individual production, client, and approval screens around that workflow.
5. Provision a separate Vercel project when a hosted preview is requested.

## Legacy documentation

The inherited architecture and roadmap files describe the source application. This file and the local AGENTS.md govern this SaaS copy. Old branding restrictions and production release directions do not apply here.

## Verification completed

- TypeScript check passed.
- Static web export passed.
- iOS bundle export passed; no simulator or physical-device session was run.
- Browser: starter setup, individual toggle, module ordering, reload persistence, task navigation, and mobile menu verified.
- Configuration normalization checked for invalid values, duplicates, empty layouts, and complete ordering.
- Production webapp Git working tree remains unchanged. Vercel/EAS links and Supabase CLI link cache are absent from this copy.

## September 6 revision: Realty Media / FameScale navigation

The user replaced the light-studio direction with stronger neutral gray surfaces, charcoal navigation, original Realty Media blue (#5256E0), and the original bundled Outfit font. The FameScaleOS sidebar implementation was inspected read-only. This copy now offers Expanded, Collapsed, and Expand on hover via the bottom sidebar control, shown on pointer hover or click and accessible by keyboard. Hover expansion overlays content without changing its offset. Preference persists with the local workspace configuration; legacy preferences default to hover. Mobile keeps its drawer navigation.
