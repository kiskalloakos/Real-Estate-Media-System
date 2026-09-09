# realty media implementation roadmap

This file preserves the approved implementation order after the first MVP review.
Each round is completed, verified, and reviewed before the next one begins.

1. **Team Access and Client Members management** — complete
   - Admin directory for realty media owners and team members.
   - Create team logins with a name, email, temporary password, and production title.
   - Suspend and restore team access while protecting owner accounts.
   - Admin management of owners and members inside each client account.
   - Client owners can add, suspend, and restore members in their own account.
   - One email maps to one Supabase login and one primary workspace role.
2. **Property-to-team assignments** — complete
   - Assign one or more realty media team members to a property.
   - Team members see only assigned properties and connected production records.
3. **Edit and archive flows** — complete
   - Clients, properties, contracts, events, and payments.
4. **Real Tasks management** — complete
   - Owners create and assign tasks; team and clients see only permitted tasks.
5. **Native detail screens** — complete
   - Clients, properties, reviews, and calendar events.
6. **Functional iOS review workflow** — complete
   - Timestamped comments, approvals, and change requests.
7. **Database-backed notifications and push delivery** — complete
   - Persistent in-app notification state and Expo push notifications.
8. **Social analytics through FameScale-approved apps** — complete
   - Facebook Login and TikTok Login for admins and clients only.
   - Multiple professional Instagram accounts and TikTok profiles per workspace.
   - Encrypted provider tokens, RLS-protected metrics, automatic/manual refresh,
     web connection management, and read-only iOS analytics.

Brand asset correction is complete: the supplied lowercase `m` PNG artwork is the
canonical web favicon, iOS app/splash icon, and in-product mark.
