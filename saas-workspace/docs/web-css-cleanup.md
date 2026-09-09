# Web CSS Cleanup Runbook

This document is the handoff and execution guide for the production web CSS
cleanup. It is intentionally specific so a new Codex chat can resume without
restarting the design discussion.

## Scope and baseline

- Canonical project: `/Users/kiskalloakos/Downloads/REALTY MEDIA/webapp`
- Production branch: `main`
- Web production path: push tested `main`; Vercel deploys `app.realtymedia.ro`
- Native iOS presentation is out of scope.
- Keep Expo SDK 56. Do not upgrade SDKs as part of this work.
- Approved visual baseline commit: `4d11547 refine approved web visual baseline`
- The purple blob/gradient application canvas and modal-backdrop gradient were
  deliberately removed and must not return.

Before modifying code, read `AGENTS.md` and
`design-system/realty-media-app/MASTER.md`.

## Non-negotiable visual contract

Preserve the web UI the user approved in the September 1 screenshots:

- Grey canvas with no decorative purple blobs or gradient field.
- Rounded white/soft-material cards with their fine white outlines and soft,
  restrained shadows.
- Blue navigation rail and blue selected/primary states.
- Current task-card and calendar-row construction.
- Current modal and popup composition unless the exact popup is being reviewed.
- Search hover/focus: blue outline and white fill.
- Profile: no coloured ring at rest; centred image and blue hover ring.
- Notification hover: no vertical movement.
- Owner workspace picker: white neutral control; blue outline when open.

Do not apply a global flat-card reset, black outlines, blanket blur deletion,
new colour palette, new typeface, card scaling, positional hover effects, or
new iOS styling.

## Current CSS ownership problem

`src/global.css` is a legacy accumulation file with more than 21,000 lines,
many repeated "final" layers, and nearly 2,000 `!important` declarations.
`src/components/web/PortalShell.css` owns web-shell overrides, but global rules
still compete with it. The cleanup goal is to make one component own each
visual rule, not to restyle the product.

CSS entrypoints:

- `src/app/_layout.web.tsx` imports `src/global.css`.
- `src/components/web/PortalShell.tsx` imports `PortalShell.css`.

## Completed work

The following work is committed on local `main` and was reviewed at localhost
after each focused batch:

- Shell/top-bar, notification modal, command palette, and client/action-form
  ownership cleanup.
- All planned screen clusters: Dashboard, Documents, Clients, Sales, Team,
  Tasks, Calendar, Finance, Gear, and Marketing.
- Shared tab/button patch layers that were demonstrably superseded.
- Client detail metric surfaces, caller/event detail surfaces, and the calendar
  event form's empty bottom area.
- Calendar simplification: Clients no longer carries a duplicate calendar tab;
  the calendar filter contains only the useful workspace calendars; fixed-width
  abbreviated month/range labels prevent header movement.
- Removal of the obsolete red, carmine, carmine-dark, carmine-soft, amber, and
  sage color aliases, plus the old Finance dot variants. `carmine-bright` was
  an undefined legacy reference and is now resolved with approved tokens.

Recent commits for this phase: `04db215`, `548eaef`, `b31796e`, and `0d68850`.

## Execution order

### 1. Shell and top bar — complete

Consolidate desktop ownership of search, notification, profile, and workspace
picker in `PortalShell.css`. Delete only global desktop rules proven to be
superseded. Preserve mobile rules until separately audited.

Check: dashboard at desktop width; hover/focus search; hover notification and
profile; open/close workspace picker; resize to mobile.

### 2. Notification modal — complete

Trace only `.rm-notification-*` rules in source order. Remove duplicate row
rules only when a later selector sets the same final computed properties. Keep
the approved final row material, border, spacing, nested content button, and
delete control. Do not touch command palette or client forms in this step.

Check: open modal; hover content row and delete control; keyboard focus; read
state; long list scrolling; narrow viewport.

### 3. Command palette — complete

Treat command palette as its own modal type. Remove duplicate generic modal
overrides only after verifying the search field, result list, keyboard hints,
empty state, and footer remain unchanged.

Check: open from global search/shortcut; type; navigate results; hover/open a
result; close with Escape; narrow viewport.

### 4. Client and action forms — complete

Separate New Client and task/event/action form rules from generic modal rules.
Eliminate nested material declarations only when the same outer control stays
visually intact. Do not replace fields with black outlines.

Check: create client; task form; event form; required/invalid states; selects;
file upload; keyboard focus; mobile width.

### 5. Screen clusters — complete

Move or consolidate rules one cluster at a time. Prefer named web CSS modules
or clearly delimited sections over another global override layer.

Order:

1. Dashboard
2. Documents
3. Clients
4. Sales/leads
5. Team
6. Tasks
7. Calendar
8. Finance, Gear, and Marketing

For each route preserve its current outlines, shadows, and card hierarchy.
Check its desktop and mobile route, filters, empty states, tables/lists, primary
action, and hover/focus states before moving on.

### 6. Shared primitive extraction — complete for verified owners

After individual owners are stable, extract only genuinely shared primitives:
surface, control, field, row, and modal foundation. Do not introduce a broad
selector such as "all cards", "all buttons", or "all forms". Remove obsolete
"final" patch layers instead of adding another one.

Check: dashboard, documents, clients, sales, tasks, calendar, and at least one
modal after every extraction.

The remaining declarations that appear repetitive belong to different state,
responsive, or component-specific selectors. They must not be merged merely to
reduce line count: that would reintroduce the global-reset regressions this
cleanup removed.

### 7. Legacy alias cleanup — complete

Legacy aliases such as `--rm-red`, `--rm-carmine`, `--rm-carmine-dark`, and
`--rm-carmine-soft` currently map to approved blue/grey values. Replace every
consumer with the semantic approved token it already represents, then delete
the alias definition only when usage is zero. Audit misleading `sage` and
`amber` aliases separately. This is a nonvisual migration.

Check: selected states, priority rails, calendar today/event states, charts,
buttons, and status labels stay blue/white/black/grey.

### 8. Web performance audit — completed where unauthenticated access permits

The web app currently feels laggy. Do not assume that one CSS property is the
only cause. First capture a Chrome Performance profile on a representative
dashboard, clients, and finances route, then distinguish scripting, layout,
paint, and GPU-compositing work. Audit repeated `backdrop-filter`, large blur
radii, layered shadows, wide `color-mix()` surfaces, long tables, and route
re-renders separately. Remove or simplify an effect only when the profile and
the affected localhost screenshot support it. Preserve the approved card
outlines, radii, soft shadows, blue rail, and popup composition.

Check: desktop scroll and navigation on dashboard, clients, finances, tasks,
and calendar; dialog open/close; search typing; and a 375px mobile route. Log
before/after measurements with the route and browser/device used.

#### Audit record — September 1, 2026

- Browser: local Chrome 152 headless, isolated temporary profile.
- Server: `http://localhost:8082`; it correctly routes a fresh profile to the
  authenticated entry screen, so workspace data and protected routes were not
  bypassed for this audit.
- Entry-screen runtime after load: 5 layouts, 8 style recalculations, 0.119 s
  script duration, 0.130 s task duration, and 15.8 MiB JavaScript heap used.
- Responsive entry-screen checks at 375, 768, 1024, and 1440 px: meaningful
  content rendered, no error overlay, no horizontal overflow, and zero active
  `backdrop-filter` surfaces.
- Static exported CSS inventory: 65 blur declarations and 162 `color-mix()`
  expressions remain in legacy, route-specific rules. Removing them without an
  authenticated route trace would violate the approved visual contract, so this
  cleanup deliberately does not make an unsupported performance claim.

For a future authenticated performance investigation, record dashboard,
clients, and finances in the already-signed-in browser, then change only the
measured bottleneck. That is a performance task, not remaining CSS-debt work.

## Validation after every batch

1. `git diff --check`
2. `npm run typecheck`
3. `npm run build:web`
4. Verify `http://localhost:8082`.
5. Run the batch-specific visual checks above.
6. Make a focused local commit only after the batch is approved.

Do not push, deploy, or modify iOS as part of this cleanup unless explicitly
asked.

## Current working state

The baseline visual contract is `4d11547`; the cumulative reviewed cleanup is
committed through `0d68850` on local `main`. No current batch is intentionally
left uncommitted.

Before touching another shared CSS section, inspect its final source-order
owner. Do not treat a class name or a duplicated-looking declaration as dead
without proving it is superseded or unused.

This CSS cleanup is complete. Future work belongs to a separately scoped,
authenticated performance investigation or a deliberately approved visual
redesign—not another blanket CSS pass.

## Resume prompt

Use this exact instruction in a new chat:

> Work in `/Users/kiskalloakos/Downloads/REALTY MEDIA/webapp` on `main`.
> Read `AGENTS.md`, `design-system/realty-media-app/MASTER.md`, and
> `docs/web-css-cleanup.md`. Continue the next unfinished cleanup batch only.
> Preserve the approved web visual contract, keep Expo SDK 56, leave iOS alone,
> run the listed validation, commit only the reviewed batch, and do not deploy.
