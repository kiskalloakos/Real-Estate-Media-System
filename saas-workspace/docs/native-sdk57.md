# Native workspace — SDK 57

The native iOS and Android source is part of `saas-workspace`, alongside the web app. No additional clone is needed. All work in this pass is confined to this copy; the original `../webapp` remains unchanged.

## Application isolation

- App name: Agency Workspace
- iOS bundle identifier: `ro.realtymedia.workspace`
- Android package: `ro.realtymedia.workspace`
- Deep-link scheme: `agencyworkspace`
- No production environment secrets, EAS project ID, update URL, or App Store submission ID.
- The inherited App Store Connect submission target was removed from `eas.json`.
- EAS development and preview profiles can produce Android APKs; the iOS preview profile targets the simulator.

## Functionality changes

Expo 57.0.20 / React Native 0.86.3 and SDK-compatible dependencies. Added `expo-dev-client` for dedicated development builds.

- Shared choice provider replaces four duplicated iOS-only action-sheet helpers: tasks, calendar events, gear transfer, and document/folder selection. iOS keeps its native action sheet; Android uses a scrollable dialog with cancel and hardware-back dismissal, supporting lists longer than three choices.
- Shared date/time input preserves compact iOS controls and opens Android dialogs explicitly on tap. Dismissal does not change the selected date or time.
- Native content icons, tab icons, and toolbar images have Android equivalents.
- Android push setup creates a notification channel before requesting permission and registers the actual device platform. The database already accepts Android; no migration was needed or applied.
- Form scroll views preserve handled taps when the keyboard is visible. Android uses resize keyboard behavior.
- Removed unused native badge components. Fixed the existing web analytics account-selection effect flagged by the SDK 57 lint configuration.

## Running locally

Install dependencies with `npm ci`, then use `npm run ios` or `npm run android` to start Metro and open an installed development client. To create a native development build locally, use `npx expo run:ios` (requires Xcode) or `npx expo run:android` (requires Android Studio/SDK and Java). These builds use the isolated identifiers above.

This project uses Continuous Native Generation; generated `ios/` and `android/` directories are ignored. No signed app, store upload, or cloud build was created during this pass. A separate EAS project and its credentials must be configured before cloud development builds or real push notifications. No production project should be linked.

Without Supabase environment configuration, the app opens a sample owner workspace. Preview data is intentionally separate from authenticated backend behavior; some mutations remain read-only. Configure a test backend to verify live workflows.

## Validation and remaining device checks

Passed: TypeScript, Expo Doctor (21/21), iOS export, Android export, web export, and config-plugin introspection. Lint has no errors; four existing unused-code warnings remain in the older web dashboards. Bundle exports validate JavaScript and assets; they are not signed binaries and do not establish runtime correctness.

This Mac has no Xcode simulator toolchain or configured Android emulator. Still needed on real devices/development builds: startup, all five tabs for each role, Android Back, long choice lists, task/calendar saves and cancellation, keyboard visibility, document/file picking, review playback and feedback, authentication/deep links, and push permissions/registration. Production integrations require a connected test backend and dedicated app credentials.
