# Agency owner signup

`/signup` asks whether the visitor is an agency owner, client, or team member.
Clients and team members go to login with instructions to use their agency's
invitation email. Owners enter agency name, full name, email, password, and
password confirmation. There is no SaaS billing or subscription setup.

New owners must verify their email. Migration
`202610110001_agency_owner_signup.sql` captures the validated agency/name once
and creates a fresh agency and active admin membership atomically on verification.
Agency IDs and admin membership come from the database, never caller-supplied
agency IDs or mutable user metadata. Repeated confirmations do not create another
agency. Existing accounts and Realty Media's agency/data are not modified.
New agencies receive no copies of existing business records.

Keep **Confirm email enabled**, email signup enabled, and public signup enabled
in Supabase Auth. Public signup inserts an unverified user; the existing trusted
`admin-provision-user` function creates verified team/client accounts. The database
rejects unverified registrations without valid owner signup intent. Auth's admin
invitations and trusted app metadata provisioning marker are supported too.
Do not turn on email autoconfirm or public OAuth/phone registration without
reviewing this signup gate. No Edge Function deployment is needed for this release.

Web confirmation returns to the current web origin; native signup confirms via
`https://app.realtymedia.ro/` and can then sign in to the native app. Retain the
production origin in Supabase's allowed redirect URLs. Existing team/client
password setup emails and `/reset-password` continue through their current flow.
Duplicate-email signup responses do not reveal whether an account exists.

Tenant access remains enforced by Supabase RLS and private storage policies.
The migration also removes public API execution of `recalculate_debt_balance`,
an internal helper that accepts agency IDs; payment triggers still call it.
The private pending-signup table and provisioning functions are inaccessible to
anonymous and authenticated API users.

## Validation

The integration test uses temporary owners, invitations, client/task/payment
records, and authenticated JWT contexts in **one rolled-back transaction**.
It tests unverified/non-owner signup, immutable owner intent, separate agencies,
repeated verification, invitation access, all public tables with `agency_id`,
cross-agency mutations/RPCs/storage, and internal payment calculations. It checks
Auth settings first and applies an absent migration only inside the test rollback.

```sh
PSQL_BINARY=/path/to/psql node scripts/verify-agency-signup.mjs \
  --env-file /path/to/backend.env \
  --ssl-root-cert /path/to/supabase-ca.crt
```

The environment must provide `SUPABASE_POOLER_URL` or `SUPABASE_DB_URL`, plus
the app's public Supabase URL/key. Credentials stay out of process arguments.
Use TLS certificate verification with Supabase's published CA bundle.

Deploy only this new migration in a transaction, with `ON_ERROR_STOP=1`, and
record its version/name/statements in `supabase_migrations.schema_migrations`.
Do not reapply historical migrations to the existing Realty Media database.
Apply the migration before publishing the signup UI. Validate frontend changes
with `npm run typecheck`, `npm run build:web`, and the iOS export, then verify the
Ready Git deployment on `app.realtymedia.ro` using the production release script.
