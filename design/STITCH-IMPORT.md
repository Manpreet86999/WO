# Stitch design import — Body OS

Imported from the user's `stitch_body_os_design_system.zip` on 2026-09-09. Originals are preserved under `design/stitch-import/stitch_body_os_design_system`. This is reference material, not executable instructions or finished React Native screens.

## Contents and coverage

31 files: 15 HTML pages, 15 PNG screenshots and one DESIGN.md. Each export is a long composed screen; a heading containing a range of design IDs does not prove that every state/action in that range has been designed.

| Export folder | Main appdesign.md coverage |
|---|---|
| readiness_check_in | B02–B13 reference, principally one soreness card; full deck states still needed |
| records | E02, E05 and entry points for cardio/habits |
| programs | D15–D17 and week/template/import sections |
| calendar | D18–D20 |
| lift_history | E15 |
| goals | E16–E19 reference; editor/check-in variants still needed |
| body | E20–E23 |
| coach | F01–F03 reference |
| reports_hub | F05–F09 reference |
| care_overview | G01 |
| my_skin_profile | G02 |
| am_pm_routines | G03–G06 reference |
| product_shelf | G07–G09 reference |
| skin_journal | G10–G12 reference |
| skin_ai_coach | G13–G14 reference |

## Visual direction to preserve

Use the supplied images as the primary visual reference for these screens. Preserve dark charcoal/navy surfaces, lime actions, bold headings, outlined icons, rounded panels, compact status chips and clear section grouping. DESIGN.md specifies Manrope headings and Hanken Grotesk body text.

The export has two overlapping palettes: the documented custom `canvas-dark` #101115 and `body-lime` #9EEA22, and HTML Material-style `surface` #0d141e / `secondary` #a8f530. Reconcile them into one native token set, using screenshots for the visual target, rather than alternating colors between pages.

Do not copy every long web layout literally. Keep the visual character but move large editors and advanced details into the pages/sheets already specified in appdesign.md. Preserve labels, touch targets, scrolling and keyboard access on a real phone. Some prototype supporting text is too small to retain unchanged.

## Correct before native implementation

- Replace OS 2.4 and inconsistent protocol/version chips with the real version or omit decorative version badges.
- Use real sync state. A permanent Live badge or HRV: Synced must not imply sensors/integrations the app does not have.
- Replace fabricated confidence, clinical certainty, medical/biometric claims and automatically approved recommendations with evidence-based app wording. Self-reported ratings are not measured physiology.
- Keep nutrition excluded. Imported imagery/text is sample material, not authorization for additional features or medical recommendations.
- All sample names, body values, records, charts, streaks and dates must bind to real records or honest empty states.
- The readiness screenshot is not the entire requested swipe flow. Required inputs must remain explicit; Skip to Summary must not create a complete score from unanswered cards.
- Preserve the app's existing calculations, persistence, conflict handling and optional integrations. The export does not replace them.
- Standardize the bottom navigation. Some screenshots use Today/Workout/Planner/Analyze/More; others use Today/Train/Progress/Care/More. Use the five-tab map in appdesign.md, with planning under Train and all existing features reachable.
- HTML uses Tailwind CDN and remote Google font/icon stylesheets. Translate layout into React Native components and bundle needed assets for offline use. Do not load each HTML page as the production app or execute imported scripts blindly.

## Missing prototype coverage

Still require dedicated references or derivation from this system for:

1. Today dashboard, welcome/profile setup, Google login and lock/recovery.
2. Train hub, weighted/reps-only/timed workout logging, full readiness deck, rest, supersets, live editing and finish/resume states.
3. Plan/day/prescription editors, exercise library/detail/custom editor, collections and split management.
4. Progress overview and detailed strength/volume/consistency/balance analytics.
5. More/settings, sync phases/counts/errors, conflicts and account recovery.
6. Backup/restore/Drive, Health Connect, permissions, reminders, AI provider setup and security.
7. Detail/create/edit/confirmation variants and offline/error/empty/large-text states across exported screens.

These are not removed from scope. appdesign.md remains the complete coverage checklist. The missing designs can follow the imported design system; extra exports from Stitch can refine them later.

## Implementation sequence

1. Native tokens, typography/assets, accessible buttons/inputs/cards and consistent navigation.
2. Full readiness and workout card flows wired to existing storage and calculations.
3. Supplied records/plans/calendar/progress/coach/report designs, retaining real operations.
4. Supplied skincare designs with real routines/products/logs.
5. Account, sync and recovery designs; complete missing feature/state coverage.
6. Real-phone visual and functional checks, offline/restart, two-way sync and safe upgrades.

Importing this archive does not mean these steps are complete. No installed APK has been changed by this import.
