# Script writing

The Scripts screen opens a full-screen screenplay workspace with Script, Floor Plan, and Split View. Scene elements include action, character, dialogue, parenthetical, and transition. Cmd/Ctrl+Enter inserts the next element. Scene and shot order can change without changing their IDs.

Each location owns its reusable rooms, doors, windows, furniture, and optional PNG/JPEG/WebP plan image. Each scene owns its camera/talent positions, movement arrows, shots, and links to rooms and dialogue. Plans are schematic, not measured architectural drawings. Images are resized before saving. Editing a shared location updates every scene using it; positions belong to the individual scene.

Screenplays and production packs open a browser print preview. Save as PDF there. The export uses selectable text and vector plans; character cues stay with their dialogue where the print engine permits. The production pack includes plans, scene notes, and shots grouped by location.

## Persistence and compatibility

The existing `cabana_scripts.brief` JSON object stores the versioned production document under `production`. Existing brief fields remain alongside it. The `script` column retains a plain text screenplay for existing readers and search. Both are saved in the same database write through the existing authenticated service and policies. No database migration or Edge Function deployment is required.

Existing plain text scripts open unchanged. Conversion is explicit and preserves the original text in an action element. Unknown production versions, invalid geometry, and broken links prevent saving over unreadable production data. Removing a room, shot, or dialogue element clears affected links.

AI generation continues through the deployed `generate-cabana-script` function. It produces Romanian spoken copy, inserted as a narrated scene or reviewed in the editor before insertion. It does not infer room geometry. The existing variation generator remains available for saved briefs.

In an explicitly unconfigured sample workspace, scripts persist only in browser local storage (`rm:sample-screenplays:v1`). This is not a fallback for authenticated errors. A failed live save retains the editor draft and shows the error.

## Validation

Run `npm run typecheck`, `npm run build:web`, and `node --test scripts/screenplay.test.mjs`. Browser checks should create three scenes, draw and name a room, place and link a camera to a shot, change scene order, save, reopen, and export a production pack. Use sample mode or a test agency for writes.
