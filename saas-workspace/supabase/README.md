# Realty Media Supabase foundation

The migrations in this directory define an agency-scoped application schema.
Realty Media is the only agency for the MVP, but every business record carries
`agency_id` so a future customer deployment can use the same schema safely.

No project URL, API key, database password, connection string, or owner email is
stored in this directory.

## Migration order

1. `202607260001_foundation_schema.sql` creates enums, tables, constraints, and
   indexes.
2. `202607260002_security_functions.sql` creates Auth profile synchronization,
   access helpers, controlled RPCs, workflow triggers, and audit triggers.
3. `202607260003_rls_and_storage.sql` enables RLS, installs the role matrix, and
   creates private Storage buckets and object policies.
4. `202607260004_fix_invitation_conflicts.sql` qualifies invitation-acceptance
   conflict targets so invited client and team accounts can attach reliably.
5. `202607260005_expand_review_documents.sql` through
   `202607270002_push_device_hardening.sql` add review documents, access management,
   property assignments, archive flows, notifications, and push hardening.
6. `202607270003_instagram_analytics.sql` adds encrypted Instagram connections,
   account/media analytics, sync history, and admin/client-only RLS.
7. `202607270004_instagram_scheduled_sync.sql` enables the internal scheduled request
   that processes due Instagram connections.

Apply migrations only through the normal linked Supabase migration workflow.
Do not paste application credentials into migration files or commit a linked
project's temporary CLI state.

## First-owner bootstrap

`public.bootstrap_first_admin(owner_user_id, agency_name, agency_slug)` is
atomic and refuses to run after any agency exists. It also requires the selected
Auth user's email to be verified.

It is intentionally **not executable by `authenticated`**. Granting it broadly
would create a first-user ownership race while public Auth signup exists. Run it
once as the database owner in the Supabase SQL Editor after signing up the first
owner, or add a temporary allowlisted migration after the owner email addresses
are known. Do not permanently grant it to `anon` or `authenticated`.

Example owner-only SQL Editor call:

```sql
select public.bootstrap_first_admin(
  '<verified-owner-auth-user-uuid>'::uuid,
  'Realty Media',
  'realty-media'
);
```

After it succeeds, the agency and first active admin membership exist in the
same transaction.

## Admin-created user flow

Creating an Auth user inserts only a `profiles` row. A profile without an active
`agency_memberships` row cannot see agency, client, property, billing, media, or
operations data.

The web client can therefore use this flow without a service-role key:

1. Keep the owner's normal Supabase client/session active.
2. Create a secondary Supabase client with `persistSession: false`.
3. Call `signUp` on the secondary client using the client's email and temporary
   password.
4. Insert the new `client_accounts` row using the owner's normal client.
5. With the owner's normal client, call:

```text
admin_attach_client_user(
  p_agency_id,
  p_auth_user_id,
  p_client_account_id,
  p_client_role := 'owner',
  p_full_name
)
```

The RPC verifies that the caller is an active agency admin, verifies that the
client account belongs to the agency, and atomically creates/activates the
agency and client memberships. If step 5 fails, the new Auth user remains
unattached and sees no business data.

`admin_attach_team_user` provides the equivalent controlled attachment for a
team member. The invitation alternative is `create_invitation` followed by
`accept_invitation`; raw invitation tokens are returned once and only their
SHA-256 hashes are stored.

## Private Storage paths

- `avatars`: `{userId}/{filename}`
- `client-files`:
  `{agencyId}/{clientAccountId}/{propertyId|_account}/{category}/{filename}`
- `media-review`:
  `{agencyId}/{clientAccountId}/{propertyId}/{mediaAssetId}/{filename}`
- `agency-files`: `{agencyId}/{category}/{filename}`
- `gear-files`: `{agencyId}/{gearItemId}/{filename}`

Suggested account-level categories are `_account/profile` and
`_account/contracts`.

All buckets are private. Clients may read files for their own client accounts
and properties. They may upload account/property documents but cannot replace
or delete them directly. Only admins or assigned team members can write review
media, and only admins can manage agency and gear files. Signed URLs should be
short-lived.

## Permission summary

| Resource | Admin | Team member | Client |
| --- | --- | --- | --- |
| Agency and memberships | Manage | Read relevant staff | Read self/relevant staff |
| Client accounts | Manage | Assigned-client context | Own accounts |
| Properties | Manage | Assigned only | Own client properties |
| Contracts and billing | Manage | No | Read client-visible own records |
| Deliverables | Manage | Read assigned context | Read client-visible own records |
| Review media | Manage | Manage assigned properties | Read/review own visible media |
| Calendar/tasks/notes | Manage | Assigned/shared internal work | Client-visible dates/items |
| Gear | Manage | Read own/property assignments | No |
| Finances | Manage | No | No |
| Audit events | Read | No | No |

The database—not the UI—is the final authorization boundary.

## Social analytics server configuration

The following are Supabase Edge Function secrets and must never be committed:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_API_VERSION`
- `META_OAUTH_SCOPES`
- `REALTY_MEDIA_WEB_URL`
- `INSTAGRAM_SYNC_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_OAUTH_SCOPES`
- `TIKTOK_SYNC_SECRET`

`INSTAGRAM_SYNC_SECRET` is also stored under
`realty-media-instagram-sync-secret` in Supabase Vault so the database scheduler can
authenticate its Edge Function request. `TIKTOK_SYNC_SECRET` is stored under
`realty-media-tiktok-sync-secret` for the TikTok scheduler. The Facebook Login and
TikTok apps must allow the exact configured redirect URIs.
