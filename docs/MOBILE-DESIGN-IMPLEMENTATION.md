# Body OS Android design implementation

Updated 13 September 2026. Reference: `design/stitch-import-v2/stitch_body_os_design_system`.

## Implemented in source

- First-run welcome, Google sign-in or offline entry, name and units, short introduction, and persisted completion. Existing profile fields are retained and revision checked when saving.
- Five main destinations: Today, Train, Progress, Care and More. Plans and library are available inside Train. Existing mobile feature components remain connected to their original storage and actions.
- Charcoal surfaces, lime accents, larger headings, rounded cards and focused feature destinations across the mobile app.
- Readiness and workout swipe cards with explicit save actions, validation and button alternatives. Both screen edges remain available for Android navigation.
- Weighted, repetitions-only and timed set entry. Set saving starts a stored rest countdown. Notification denial leaves the on-screen countdown available.
- Google is the only account sign-in shown in the app. Firebase project settings are built in. Manual sync reports records processed.
- The first cloud transfer is now a review step: Body OS counts local/cloud records and conflicts before it merges anything. Foreground automatic sync begins only after that reviewed transfer.
- Dedicated native program, training-calendar, backup/recovery and routine-run screens now replace their generic menu counterparts. Backups are reviewed before restore and create a safety copy first.
- Routine completion is separate from skin observations. A completed AM/PM routine does not create invented barrier, hydration, oiliness or irritation values; charts use only self-reported values.

## Verification and limits

The shared unit suite and mobile TypeScript checks pass. `:expo:compileReleaseKotlin` now succeeds after regenerating Android dependencies and resolving the missing `expo-font` package. A browser preview using a separate database verified the readiness flow: explicit answers, local save, reload recovery and no runtime errors. Its screenshot is at `scratch/design-review/readiness-result.png`. No real-phone visual acceptance, Google login, live sync round trip, or signed upgrade has been verified for this design.

This is a native implementation pass, not a claim that every Stitch screen or every web feature is complete. Existing generic editors are retained. The full feature gaps and acceptance gates remain in `docs/MOBILE-PARITY.md`. Dedicated screen layouts, unsaved-editor navigation handling, typography assets, accessibility/device layout review, and full parity validation still need work.

The timed set stopwatch pauses when its card unmounts; the entered duration is retained. It is not a background stopwatch. Workout and readiness entry drafts are stored locally. Other feature editors may require saving before changing tabs.

No nutrition, paid billing, unsupported health-sensor conclusions, or unimplemented encryption/biometric promises have been added.

## Build and installation

The existing release key and package identity must be preserved for updates. A debug APK uses a different signature and cannot replace the installed release APK. Do not uninstall the existing app to work around this: it may remove local records. Build a release with the existing private keystore through the local password prompt for an upgrade, after validation.
