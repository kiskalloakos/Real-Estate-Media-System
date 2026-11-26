# Phone workspace verification — 26 November 2026

The web workspace now uses bottom navigation on phones, including landscape.
The existing Outfit typeface, charcoal surfaces, blue actions, record URLs,
enabled modules, and role permissions are retained.

## Navigation

| Role | Bottom destinations | More |
| --- | --- | --- |
| Admin | Home, Projects, Tasks, Calendar | Clients, Agency, workspace settings, account |
| Client | Home, Reviews, Calendar, Documents | Analytics, Deal, account |
| Team member | Home, Tasks, Calendar, Reviews | Documents, SOPs, account |

Unavailable modules are omitted. Projects and Agency still contain their tools;
the old sidebar dropdowns have not been restored. Desktop keeps its sidebar.

## Layout and interaction

- Header actions, bottom tabs, form controls, checklist labels, and module
  switches have touch targets of at least 44 pixels.
- Text, task descriptions, agreements, reading pages, and metadata have readable
  sizes. Wide filter strips scroll within their own containers.
- Forms fill the visible phone viewport, respect safe areas, and scroll without
  fixed footers covering fields. More uses a short sheet with account actions.
- VisualViewport handling adjusts the app when the visible browser area shrinks.
  Bottom tabs hide while a keyboard reduces the editing area. Pinch zoom remains
  enabled.
- Script editing keeps its dedicated dark layout. Floor plans and page editors
  remain available. Transparent review images use a checkerboard preview.
- A web manifest, existing brand icon, status-bar metadata, and viewport-fit
  metadata support standalone browser presentation. No offline cache was added.
- Browser preferences and query-based record routes load after hydration to avoid
  hydrating a saved screen against a different server-rendered screen.

## Verification evidence

Browser interaction checks used the in-app Chromium browser, with phone layouts
at 320×700, 390×844, 430×932, landscape at 844×390, and desktop at 1440×1000.
These are emulated viewport dimensions, not physical-device testing.

Owner screens inspected: overview, projects and project details, clients,
tasks, calendar, documents, reviews, team, gear, scripts, sales, finances,
marketing, and settings. Client checks covered the dashboard, reviews, feedback,
calendar and booking form, documents, agreement, and analytics. Staff checks
covered the dashboard, assigned tasks and updates, calendar, reviews, and SOPs.
Client and staff bottom destinations and content widths also passed at 320px.

Local sample interactions verified task creation, task update and undo, client
feedback posting, search navigation, notifications, role preview and return to
owner, and sign-out/sign-in presentation. A focused task form was tested with
the viewport reduced from 844px to 500px: the dialog matched the 500px visible
height, kept its 390px width, hid bottom tabs, and submitted successfully.
This checks the resize response; it does not exercise an actual OS keyboard.

Typecheck, lint for the changed React files, production web export, and the
project/task, page, screenplay, review, and workflow test suites pass.

## Phone preview

The separate sample export is served at
http://192.168.0.106:8092/?screen=dashboard on the Mac's current local network.
The phone must share that network. The server exposes only the exported sample
directory, not the repository or environment files. This build contains no
configured backend host; local sample changes do not write to production.

Export sample builds with an empty backend configuration and `--clear` to avoid
reusing Metro transforms from a configured production build. Keep sample output
outside `dist`; validate the normal production export separately with `--clear`.

Physical iPhone Safari and Android Chrome keyboard behavior, touch dragging,
browser chrome, install presentation, and authenticated backend flows still
require device/test-account checks. No production deployment or backend changes
are part of this work.

Design reference: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
using its responsive, touch, form, and React guidance with the existing app design.
