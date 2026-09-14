# Stitch export 2 — latest reference

The second user-supplied ZIP is the latest visual reference. All originals are preserved separately from the first import. This is a design import, not a native implementation or device-test result.

## Verified inventory

- 45 screen folders, each containing code.html and screen.png.
- 1 shared DESIGN.md: 91 original files total.
- 30 new screen folders relative to export 1.
- Five concepts have _1/_2 alternatives: welcome, sleep, energy, stress and pain. These are alternate references, not ten independent features.
- HTML is web prototype code. Translate to React Native components and real application actions; do not replace the existing app with static HTML.
- manifest.json records original HTML hashes and file locations.

## Design choices for implementation

Use the supplied layout and dark/lime visual language. Standardize Today / Train / Progress / Care / More navigation from appdesign.md; some variants still show the older navigation. Prefer consistent V4 naming over OS 2.4 labels. Choose the clearest variant per flow; preserve alternatives for comparison.

Keep required readiness inputs explicit, especially pain Yes/No. Do not adopt preselected pain answers or skip-to-summary behavior that generates a score from unanswered questions. Workout swipes navigate; Log set and Finish explicitly save.

Replace sample metrics with real records or empty states. Do not claim encryption, end-to-end encryption, encrypted export, hardware secure enclave, biometrics, live heart rate/HRV, sensor-derived cortisol/CNS measurements or automatic physiological clearance unless the implementation supports and verifies that exact capability. Keep self-reported energy/stress/soreness wording simple. Secure token storage alone does not make the workout database or backup end-to-end encrypted.

Conflict resolution must not label the phone version recommended by default. Compare actual changes and let the user choose. A screen with background-sync switches does not imply Android background scheduling is implemented.

## Coverage still to resolve

This ZIP supplies substantially more reference screens, but it is not a one-to-one export of all 140 catalog IDs/states. Today is still not a dedicated dashboard export: a generic Dashboard header on other pages does not count as Today. Dedicated More/settings, onboarding profile/tour, full readiness review/result/history, Train selection/resume/queue, advanced workout sheets, split/collection management, detailed habit/cardio flows, several skincare editors, and complete permission/restore/error states still need derivation or additional designs.

No need to block implementation on another export: derive missing screens from the shared design system and appdesign.md, retaining all feature coverage. Do not silently remove a missing feature. The first import audit remains useful for initial observations; this inventory supersedes its 15-screen count.

## Original screen inventory

| Screen folder | New in second ZIP | Changed HTML from first ZIP |
|---|---|---|
| am_pm_routines | No | Yes |
| app_lock_pin_a09 | Yes | No |
| backup_center_h10 | Yes | No |
| body | No | Yes |
| calendar | No | Yes |
| care_overview | No | Yes |
| coach | No | Yes |
| day_editor_d04 | Yes | No |
| device_sync_h06 | Yes | No |
| exercise_library | Yes | No |
| finish_workout_review_c20 | Yes | No |
| goal_editor_e18 | Yes | No |
| goals | No | Yes |
| lift_history | No | Yes |
| measurement_editor_e21 | Yes | No |
| my_skin_profile | No | Yes |
| plan_import_preview_d06 | Yes | No |
| prescription_editor_d05 | Yes | No |
| product_shelf | No | Yes |
| programs | No | Yes |
| progress_overview_e01 | Yes | No |
| readiness_check_in | No | Yes |
| readiness_energy_b06_1 | Yes | No |
| readiness_energy_b06_2 | Yes | No |
| readiness_pain_check_b10_1 | Yes | No |
| readiness_pain_check_b10_2 | Yes | No |
| readiness_sleep_b03_b04_1 | Yes | No |
| readiness_sleep_b03_b04_2 | Yes | No |
| readiness_stress_b07_1 | Yes | No |
| readiness_stress_b07_2 | Yes | No |
| records | No | Yes |
| reports_hub | No | Yes |
| reps_only_set_flashcard_c07 | Yes | No |
| resolve_conflict_h07_h08 | Yes | No |
| rest_timer_c10 | Yes | No |
| session_detail_e03 | Yes | No |
| session_editor_e04 | Yes | No |
| skin_ai_coach | No | Yes |
| skin_journal | No | Yes |
| strength_prs_e11 | Yes | No |
| timed_exercise_flashcard_c08 | Yes | No |
| week_editor_d03 | Yes | No |
| weighted_set_flashcard_c06 | Yes | No |
| welcome_entry_a02_1 | Yes | No |
| welcome_entry_a02_2 | Yes | No |
