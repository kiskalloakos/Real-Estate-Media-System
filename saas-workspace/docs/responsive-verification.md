# Mobile web verification — 6 September 2026

Scope: isolated SaaS workspace, browser preview with no Supabase configuration. Production and the native application are untouched by this responsive pass.

## Changes

- Reconnected inherited feature styles to the new workspace shell.
- Mobile client directory uses labeled cards; wide data tables scroll inside their own containers.
- Phone navigation scrolls independently, accommodates safe areas, and returns each page to its top.
- Shared forms use one column, 16px input text, and larger touch targets.
- Body-portaled dialogs fill the phone viewport, keep the close control accessible, and scroll their contents. Client form footers no longer cover fields.
- Empty calendar agendas explain the selected period instead of appearing blank.

## Browser checks

All twelve owner workspace pages were navigated and measured at widths 375, 768, and 1440 CSS pixels: Overview, Clients & properties, Tasks, Calendar, Reviews, Documents, Team, Marketing, Sales, Gear, Finances, Scripts. Document width equaled viewport width in all 36 cases. At 390px, client details also passed.

Creation dialogs opened and closed at 390 × 844: task, document, team member, lead, gear item, script, property, and deliverable upload. Dialog and body width checks passed without horizontal overflow. Client and event forms were inspected as well. Visual inspection covered client cards, review room, property editor, and calendar.

TypeScript and Expo web export pass. These checks establish responsive layout and navigation, not end-to-end backend functionality.

## Remaining validation

Use a separate test backend for authentication, client workspace impersonation, saves, media uploads/playback, script generation, Instagram and billing. The sample client workspace button currently lacks a matching authenticated membership; open the client identity for its preview detail page. Sample details do not include linked production records. Native iOS/Android and physical-device keyboard, camera/file picker, and Safari behavior still require device checks. No production data or credentials were copied.

## Phone preview

Verified local preview: http://127.0.0.1:8092. A LAN server was attempted on port 8094, but connection verification timed out; physical phone access is not confirmed. The servers serve only the exported preview, not source files or environment variables. No Vercel deployment was made.
