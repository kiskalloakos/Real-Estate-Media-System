# JOO reuse boundary

The approved JOO reuse is narrow and admin-only.

## Included in realty media Finances

- Business accounts and transaction ledger.
- Monthly budget, revenue, expenses, and profit.
- Debts: original amount, paid amount, remaining amount, notes, currency, and status.
- Recurring/periodic costs: amount, currency, due day/month, monthly/quarterly/yearly
  or custom interval, paid state, payment month, and source account.

These concepts and useful interaction patterns may be freely adapted from JOO. They
will be rebuilt with realty media styling, Supabase persistence, realty media roles,
and tenant-aware row-level security.

## Explicitly excluded

- JOO authentication or user model.
- JOO local/device storage as the source of truth.
- Any JOO money feature outside the Business, Debts, and Recurring Costs scope above.
- Speculative shared databases or runtime package coupling.
