# Body OS 4.0 — Android design specification

Prepared for Google Stitch · 9 September 2026

**Latest Stitch export:** `design/stitch-import-v2/stitch_body_os_design_system` contains 45 screen designs and is the current visual reference. See `design/STITCH-IMPORT-V2.md` for variants and remaining coverage.

**First Stitch export received:** the user's supplied screen images and HTML are preserved under `design/stitch-import/stitch_body_os_design_system`. See `design/STITCH-IMPORT.md` for the 15-screen inventory, visual reconciliation and missing coverage. Use those images as the visual reference for supplied screens; the full page/action/state catalog below remains in scope. Sample values and claims in the export are not live app data.

## Purpose and scope

Create a complete, linked Android prototype for training, readiness, planning, progress, skincare, coaching and shared settings. This is a proposed design grounded in the current project, not a claim that all mobile features are implemented or tested.

The current web app has **20 main page files**. The Android app currently groups functions under Today, Tracker, Plan, Progress, Care and More, often as long stacked forms. The design below breaks these into focused pages, cards and sheets. Preserve every web capability while making it usable on a phone.

**Non-negotiable:** full feature coverage before implementation is declared complete; no nutrition, meal planning, calories, macros, food photos, subscriptions or social feed. Existing legacy nutrition fields do not need new UI. Skin hydration is a skin-condition rating, not water intake. Core logging must work offline without Google login. The camera coach is a future concept, not a currently working feature.

## 1. Visual direction: premium, calm and precise

Use a deep charcoal-green canvas, softly raised surfaces, warm white text and restrained electric-lime actions. Give the active task space. Quality should come from typography, alignment, helpful feedback and consistent components. Avoid glowing borders, heavy glass blur, cramped statistics, tiny labels and decorative charts.

These are proposed tokens, not a description of an already finished redesign:

| Element | Specification |
|---|---|
| Background | #0B100E |
| Panel / raised panel | #151D18 / #202C24 |
| Primary / secondary text | #F4F7EF / #B3BFB5 |
| Primary action | #B5ED73 with dark text |
| Skincare accent | #9BDDCB; same underlying design system |
| Caution / error | #F4C46B / #FF9B9B, always with text and icon |
| Border | #34463A, subtle 1px |
| Type | Consistent Android system sans or licensed sans; clear numeric figures |
| Type sizes | 30–34 headline; 22–24 section; 16 body/input; 13–14 supporting text |
| Spacing | 4, 8, 12, 16, 24, 32; approximately 20 horizontal page margin |
| Corners | 20–24 cards; 12–16 fields/buttons; pills for short filters |
| Touch | At least 48 × 48 dp targets, including icon buttons |
| Icons | One outlined icon family; labels on navigation; no emoji navigation |
| Motion | Short 180–250ms transitions; reduced-motion alternative |
| Prototype canvas | 412 × 915; verify 360 × 800 and increased text size |

Validate contrast. Include a light-theme example using warm off-white surfaces, dark text and darker green actions. Respect Android status/navigation bars, gesture insets, keyboard and system Back.

**Today:** compact date/header and account avatar; large today's-workout card; readiness card; small weekly consistency strip; shortcuts to briefing, goals and weekly review. Do not put every metric above the fold.

**Workout:** exercise and set index at top, target and last actual performance together, large load/reps or timer inputs, one Log set action and clear rest status. Secondary tools open sheets.

**Progress:** one selected metric with a readable chart, range chips, a short interpretation and a dated list. Detailed analytics get their own named destinations.

## 2. Navigation

Proposed bottom tabs: **Today · Train · Progress · Care · More**. This replaces the current six-tab arrangement in the design proposal only.

- Today: daily dashboard, readiness, morning brief, habits due and weekly review.
- Train: Start/Resume, Plans, Calendar, Library, Programs. Use labelled hub links rather than extra bottom tabs.
- Progress: overview, Records, Lift history, Goals, Body, Reports, detailed analytics.
- Care: overview, AM/PM routines, Products, Journal, My Skin, Skin Coach.
- More: account/sync, profile, training settings, backups, health integrations, AI settings, reminders, appearance, help and data management.
- Training Coach is reachable from Today and Train. Skin Coach belongs in Care. Provider settings are shared.
- During a workout, other pages show a Resume workout strip. Focused logging may hide the bottom bar, but has a visible minimize/close action.
- Every detail frame has a back destination; navigating away must preserve or explicitly discard a draft.

## 3. Catalog conventions

**Page** means a full screen; **Sheet** means a bottom sheet/dialog; **Card** means a step in a focused flow; **State** means a screen variant. These are prototype frames, not separate bottom tabs. Create/edit can share a component but both populated and empty states must be shown.

All IDs below are design coverage requirements. Some split existing web actions into new mobile screens; others cover native system states. Their presence does not mean their mobile implementation is finished. Use current schemas to finalize fields and the parity ledger to track implementation.

## A. Entry and identity

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| A01 | Launch / State | Brand and brief local loading; recovery route | Loading, migration, recoverable failure |
| A02 | Welcome / Page | Training/care introduction; Continue offline; Google login | New/returning user |
| A03 | Profile setup / Page | Name, units, height, applicable existing profile fields; Save | Validation, optional-field skip |
| A04 | Feature tour / Page | Logging, plans, care and backups; next/finish | Resume and replay |
| A05 | Google sign-in / Page | One Continue with Google button and offline option | Opening chooser, cancellation, failure |
| A06 | Existing email login / Sheet | Optional email/password login | Invalid credentials, unavailable provider |
| A07 | Account / Page | Connected identity and sign out | Guest, signed in, expired login |
| A08 | First sync review / Page | Local/cloud record context; review before combining | Empty cloud, existing cloud, other account bound |
| A09 | App lock / Page | PIN entry, unlock and recovery route | Wrong PIN, locked, recovery explanation |
| A10 | Permission explanation / Sheet | Contextual notification/health permission purpose | Not asked, denied, open settings |

## B. Today and readiness

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| B01 | Today / Page | Current workout, readiness, consistency and next action | First use, rest day, due, in progress, completed |
| B02 | Check-in start / Page | Date, source freshness, flow overview; Begin | Existing check-in: view/edit |
| B03 | Sleep duration / Card | Hours/minutes; next/back | Empty, entered, imported with source/date |
| B04 | Sleep quality / Card | Labelled 1–10 rating | Unanswered/selected |
| B05 | Soreness / Card | Labelled 1–10 rating, optional note | High soreness |
| B06 | Energy / Card | Labelled 1–10 rating | Unanswered/selected |
| B07 | Stress / Card | Labelled 1–10 rating | High stress |
| B08 | Motivation / Card | Labelled 1–10 rating | Unanswered/selected |
| B09 | Mood / Card | Rating compatible with existing data | Unanswered/selected |
| B10 | Pain check / Card | Explicit Yes/No; route to pain entry | Neither preselected; pain-positive guidance |
| B11 | Optional context / Card | Resting HR, steps where supported, notes; Skip/Next | Manual/imported; absent values |
| B12 | Readiness review / Page | Answers with edit links; Save check-in | Invalid, saving, saved locally |
| B13 | Readiness result / Page | Score/band, contributors, dated recommendation | Incomplete/stale data, low readiness, pain |
| B14 | Readiness history / Page | Dated entries and trend; open entry | Empty, range filter |
| B15 | Readiness entry / Page | Inputs, result, notes; edit | Historical; delete only where supported |
| B16 | Morning briefing / Page | Dated training summary; related plan links | Local advice, AI, insufficient data |
| B17 | Weekly review / Page | Week, existing review fields and actual summary; Save | New/edit, incomplete week |

## C. Workout execution and flashcards

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| C01 | Train hub / Page | Start/Resume and plan/library/calendar/program links | No plan, active plan, active session |
| C02 | Workout selection / Page | Scheduled day, saved day or custom session | Rest day, empty plans |
| C03 | Workout preview / Page | Exercise list, prescriptions, readiness guidance; Start | Planned, custom, modified |
| C04 | Resume draft / Sheet | Draft date and progress; Resume or confirmed discard | Stale draft, interrupted session |
| C05 | Exercise introduction / Card | Equipment, muscles, cue, targets, tutorial access | Custom exercise, no tutorial |
| C06 | Weighted set / Card | Load, reps, set index, target, previous actual; Log set | Empty, invalid, saved, edit |
| C07 | Reps-only set / Card | Reps and previous performance; Log set | No irrelevant load field |
| C08 | Timed set / Card | Duration, start/pause and manual entry; Log set | Running, paused, finished |
| C09 | Set details / Sheet | RIR/RPE, set type, side, rest, tempo, notes | Optional; supported warm-up/working/drop/failure types |
| C10 | Rest timer / Card | Countdown, +30 seconds, skip, next exercise | Running, done, notifications denied, background return |
| C11 | Exercise queue / Sheet | Completed/remaining sets and jump action | Skipped, substituted, superset labels |
| C12 | Add/substitute / Sheet | Search library, favourites, custom entry; confirm | Session-only change versus plan edit |
| C13 | Superset round / Card | Group, current member, next movement | Round complete and rest |
| C14 | Warm-up builder / Sheet | Target load and editable warm-up stages | Missing load, bodyweight alternative |
| C15 | Plate calculator / Sheet | Units, bar, available plates, per-side result | Exact load unavailable |
| C16 | Previous performance / Sheet | Dated sets, mode, side, effort and notes | No history; explicit units |
| C17 | Live session log / Page | All recorded sets; add/edit/remove | Confirm deletion, protect against double taps |
| C18 | Exercise completion / Card | Actual versus planned work; Next exercise | Skipped/unlogged clearly distinguished |
| C19 | Progression suggestion / Sheet | Target and supporting history; apply/keep | Insufficient history, hold, plateau |
| C20 | Finish review / Page | Totals, unlogged sets, notes; Finish and save | Partial session, saving, offline |
| C21 | Session result / Page | Actual duration/work, valid PRs, report/debrief link | No PR, local summary, optional AI |
| C22 | Pause/end / Sheet | Resume, finish partial session, discard | Explicit separate effects and confirmation |

## D. Plans, library, programs and calendar

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| D01 | Plans / Page | Active/saved/completed weeks; create/import | Empty, search, completed |
| D02 | Week detail / Page | Days, dates, notes/status; start, activate, duplicate | Rest days, completed, template origin |
| D03 | Week editor / Page | Name/date/number/notes; add/reorder days | Create/edit, unsaved changes |
| D04 | Day editor / Page | Title/type/muscles/date and movements | Rest day, reorder/remove |
| D05 | Prescription editor / Sheet | Volume/mode/cue, rest/tempo, RIR/RPE, %1RM, superset | Basic/advanced; invalid values |
| D06 | Plan import / Page | Supported file/paste, parsed preview; confirm | Invalid rows, duplicates |
| D07 | Week actions / Sheet | Duplicate/export/save split/complete/archive/delete | Preserve actual workout history |
| D08 | Exercise library / Page | Search, muscle/equipment/mode filters, favourites | Bundled/custom, empty filters, pagination |
| D09 | Exercise detail / Page | Muscles, equipment, mode, cue, defaults, tutorial/history | Favourite, missing tutorial |
| D10 | Exercise editor / Page | Existing custom exercise fields; Save | Create/edit/archive/delete as supported |
| D11 | Collections / Page | Grouped browsing and membership | Empty, add/remove; confirm supported source actions |
| D12 | Saved splits / Page | Built-in/custom split catalog; preview | Template versus custom distinguished |
| D13 | Split detail/editor / Page | Days/prescriptions; Use as week, duplicate/edit | Start-date choice; preserve source template |
| D14 | Library import/export / Page | Supported exercise/split/plan formats | Preview, unsupported format, merge explanation |
| D15 | Programs / Page | Active/saved/archived mesocycles; create | Empty and filtered |
| D16 | Program detail / Page | Ordered weeks/phases, dates, notes/status | Missing reference, completed |
| D17 | Program editor / Page | Name, weeks/phases, reorder, notes; Save | Create/edit/validation |
| D18 | Calendar / Page | Month/week/agenda and status legend | Empty, rest, scheduled/completed/missed |
| D19 | Schedule/reschedule / Sheet | Real week/day names, date; Save | Date conflicts, moved workout |
| D20 | Missed-session options / Sheet | Existing skip/reschedule actions and impact | Never mark skipped work completed |
| D21 | Deload/week completion / Page | Recommendation, proposed changes, next week | Review before applying |

## E. Records, analytics, goals and body

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| E01 | Progress overview / Page | Range, consistency, strength/volume and section links | First use, insufficient/populated data |
| E02 | Workout records / Page | Dated search/filter, import/export | Empty, matches, duplicate review |
| E03 | Session detail / Page | Exercises/sets/modes/effort/notes; edit, report | Dated data; delete confirmation |
| E04 | Session editor / Page | Date/title/notes and actual sets; save | Weighted/reps/timed; add/remove |
| E05 | Records import / Page | File/paste, format, preview; confirm | Invalid rows, duplicates, summary |
| E06 | Cardio history / Page | Type/date/duration/distance and detail links | Empty, filtered, edit/delete |
| E07 | Cardio editor / Page | Existing cardio fields, units, effort, notes | Create/edit/validation |
| E08 | Habits / Page | Active habits, due check-ins and history | Done, missed, archived |
| E09 | Habit editor / Page | Existing target/unit/frequency fields | Create/edit/remove; no nutrition templates |
| E10 | Habit check-in / Sheet | Date and actual progress; Save | Edit, duplicate date |
| E11 | Strength and PRs / Page | PR list, bests, e1RM trend | Estimated label; timed work excluded from e1RM |
| E12 | Volume analysis / Page | Weekly volume, sets, muscles, landmarks | Unit/mode-aware; warm-ups separated |
| E13 | Consistency / Page | Calendar, streak and week comparison | No activity versus missing data |
| E14 | Balance and plateaus / Page | Left/right comparison and progression evidence | Insufficient paired data; no diagnosis |
| E15 | Lift history / Page | Exercise picker, actual sets and appropriate chart | Load/reps/time modes; no invented zeroes |
| E16 | Goals / Page | Active/achieved/overdue goals | Empty, lower-is-better, archived |
| E17 | Goal detail / Page | Baseline/target/date/unit and check-in history | Latest actual value; overdue/achieved |
| E18 | Goal editor / Page | Existing type/values/date/status/notes | Create/edit/validation |
| E19 | Goal check-in / Sheet | Date/value/notes; Save/edit | Historical value doesn't override newer data |
| E20 | Body measurements / Page | Latest values, selected trend, dated history | Missing optional values |
| E21 | Measurement editor / Page | Existing measurements, units/date/notes | Create/edit/delete; optional body fat |
| E22 | Pain history / Page | Region/severity/date/aggravating movement | Empty; status where supported |
| E23 | Pain entry / Page | Existing pain/injury fields; save/edit | Required fields; no diagnosis claims |

## F. Coaching and reports

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| F01 | Training Coach / Page | Local insights, progression and questions | Local-only, AI, insufficient data |
| F02 | Coach conversation / Page | Messages, prompts, composer, clear history | Generating, failed, provider unavailable |
| F03 | AI proposal review / Page | Proposed workout/adjustments; compare, accept/reject | Invalid response, partial proposal, declined |
| F04 | Session debrief / Page | Actual recap and optional exercise feedback | Local summary; AI failure preserves workout |
| F05 | Reports hub / Page | Session/week/progress reports and exports | Empty; choose type |
| F06 | Report options / Sheet | Range/week/session and supported format | Missing selection, generating |
| F07 | Report preview / Page | Readable sections/charts; share/export | HTML/PDF equivalents, failed file generation |
| F08 | Data export / Sheet | Sessions/measurements CSV and supported other formats | Units; system share; failure |
| F09 | Report delivery / Page | Email/Telegram recipient and schedule; review/send | Not configured, sent, failed |

## G. Skincare

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| G01 | Care overview / Page | Dated skin status, AM/PM completion, products, notes | No log/profile, routine due, completed |
| G02 | My Skin / Page | Type, concerns, sensitivities, goals, climate, notes | Setup/edit |
| G03 | AM/PM routines / Page | Slot switch, ordered steps, product links; Start | Missing/paused/completed routine |
| G04 | Routine editor / Page | Name/slot, steps/product/wait time/notes; reorder | Create/edit, paused product |
| G05 | Routine step / Card | Product, instruction, wait timer; Done/Next | Skipped, running timer, no linked product |
| G06 | Routine completion / Page | Completed/skipped steps and notes; Save | AM/PM; incomplete |
| G07 | Product shelf / Page | Active/paused products, categories, search | Empty, filtered |
| G08 | Product detail / Page | Existing product info and linked routine slots | Active/paused; edit/delete |
| G09 | Product editor / Page | Name/category/usage and existing product fields | Create/edit/validation |
| G10 | Skin check-in / Page | Barrier, skin hydration, oiliness, irritation, concerns, AM/PM, notes | Today/edit previous; ratings self-reported |
| G11 | Skin journal / Page | Dated logs, consistency and condition trends | Empty, date range |
| G12 | Skin log detail / Page | Ratings, routine completion, notes and saved advice | Historical advice dated; edit |
| G13 | Skin Coach / Page | Skin-specific conversation/local guidance | Local-only, AI, provider unavailable |
| G14 | Routine proposal review / Page | AM/PM suggestions using known products | Unknown product, conflict, accept/reject |

## H. Settings, sync and recovery

| ID | Screen/type | Content and actions | Required variants |
|---|---|---|---|
| H01 | More / Page | Grouped settings, account/backup/sync summary | Guest, signed in, attention needed |
| H02 | Profile/units / Page | Existing profile fields, units, streak start | Save/errors; unit explanation |
| H03 | Training preferences / Page | Load increments and existing progression settings | Basic/advanced, defaults/edited |
| H04 | Appearance / Page | Dark/light/system and existing options | Theme previews, large text |
| H05 | Reminders / Page | Workout/care times and quiet hours | Permission denied, disabled, overnight hours |
| H06 | Device sync / Page | Account, last success, auto-sync, Sync now | Reading/uploading/downloading n/N, offline, failed, done |
| H07 | Conflict inbox / Page | Record name/type/date; review each conflict | Pending choices; cloud changed again |
| H08 | Resolve conflict / Page | Human-readable differing fields; choose version | Edit versus deletion; no raw JSON by default |
| H09 | Sync recovery / Page | Expired login or different-account binding | Sign in again; never silently mix accounts |
| H10 | Backup center / Page | Last success, local export/import and Drive | No backup, stale, working, failed |
| H11 | Create backup / Sheet | Scope/date; system destination/share | Success, storage failure; exclude secrets |
| H12 | Restore preview / Page | Version/date/counts/account and merge/replace meaning | Invalid/incompatible, safety copy, rollback |
| H13 | Drive backups / Page | Connect, backup now, dated list, download/preview | Scope denied, API unavailable, empty |
| H14 | Health connections / Page | Health Connect and supported permissions | Unsupported device, denied/partial, connected |
| H15 | Health readings / Page | Steps/sleep/resting HR with source/time | Duplicate sources, stale/missing |
| H16 | AI providers / Page | Optional provider/model settings | Unconfigured, test failed, unavailable model |
| H17 | AI diagnostics / Page | Existing model test/benchmark/fallback controls | Explicit tests; no invented latency/pricing |
| H18 | Email reports setup / Page | Existing sender/recipient/delivery configuration | Verification needed, test/send failure |
| H19 | Telegram setup / Page | Existing bot/chat/schedule settings | Unconfigured, connected, failed |
| H20 | PIN/security / Page | Enable/change PIN and recovery explanation | Current PIN, mismatch, disabled |
| H21 | Data management / Page | Exports, scoped reset and hard reset | Clear affected data; confirmed deletion |
| H22 | Help / Page | Replay tour, logging/sync/backup help, diagnostics | Offline help, redact diagnostic secrets |
| H23 | About/updates / Page | Version/build, update status, APK instructions | Available, current, check failed |
| H24 | Legacy compatibility / Page | Existing activation/email verification and integration migration | Conditional; see reconciliation notes |

## 4. Flashcard behavior — essential

For readiness B03–B11 and workout C05–C10/C18:

1. Swipe LEFT in the middle of a card for next; RIGHT for previous. Give a one-time hint and always show Back/Next buttons.
2. Reserve Android edge swipes for system Back. Slider drags, text selection and vertical scrolling must not accidentally change cards.
3. Readiness requires a deliberate answer for each required field. Previous retains values. Optional context has Skip. Only Save check-in commits the completed form.
4. Workout swipes change what is being viewed, not the data. They must never silently log/delete a set, finish a session or fill in missing actual performance.
5. Log set gives a saved acknowledgement, safe Edit/Undo, completed-count update and rest timer. Double taps must not duplicate records.
6. Show Exercise 2 of 6 and Set 2 of 3. Peek at the next card without covering fields. Keep keyboard and primary action from overlapping.
7. Persist drafts across interruption. Distinguish Saved on this phone from Sync pending.
8. All gestures need button equivalents, screen-reader labels, larger-text layouts and reduced-motion states.

Link this prototype journey: B02 → B03…B11 → B12 → B13 → C03 → C05 → C06 → C10 → C06 → C18 → C20 → C21. Also prototype C07 reps-only and C08 timed logging.

## 5. Coverage of all 20 web pages

| Existing page file | Android design coverage |
|---|---|
| Dashboard.tsx | B01–B17, C03, D21 |
| Tracker.tsx | C01–C22 |
| Planner.tsx | D01–D07 |
| Library.tsx | D08–D14, D01 |
| Programs.tsx | D01–D07, D12–D17, D21 |
| CalendarPage.tsx | D18–D20 |
| Records.tsx | E02–E10, F08 |
| Analyzer.tsx | E01, E11–E15, B14, E16–E21 |
| ExerciseHistory.tsx | E15, C16 |
| Targets.tsx | E16–E19 |
| Body.tsx | E20–E23 |
| Coach.tsx | F01–F04, C19, H16–H17 |
| Reports.tsx | F05–F09 |
| Settings.tsx | H01–H24, A07–A10 |
| skin/Overview.tsx | G01 |
| skin/Routine.tsx | G03–G06 |
| skin/Products.tsx | G07–G09 |
| skin/Progress.tsx | G10–G12 |
| skin/MySkin.tsx | G02 |
| skin/AiCoach.tsx | G13–G14 |

Shared Onboarding, UnlockGate, FeatureGuide, UpdatePrompt and conflict/queue interfaces are included through A01–A10 and H06–H24. Native-only permission, Health Connect, file-sharing and timer states are included too.

## 6. Reconcile these differences during implementation

- **Google login:** normal users never enter Firebase IDs/API keys/OAuth client IDs. Google account selection is a system/provider screen, not a Body OS password form.
- **Legacy onboarding:** current web Onboarding.tsx requires Gmail verification and a developer activation key. Include conditional H24 for coverage, but propose offline-first entry for V4. This is an intentional workflow change; the old gate has not already been removed by writing this brief.
- **Email/Telegram:** preserve configuration, scheduling and delivery review/result screens. Native execution is still engineering work. A prototype Send button does not establish integration success.
- **Health:** web Google Fit and Android Health Connect are different integrations. Preserve source-labelled readings and provide a compatibility explanation; do not imply identical permission/data availability.
- **Backup:** Google Drive backups and Firebase record sync are separate. Desktop/mobile formats are not yet fully interoperable. Restore previews must state supported format.
- **Cost:** no paywall in this brief. Optional AI providers must not be labelled unlimited/free by default. Local guidance stays usable without a provider.
- **Accuracy:** show Not logged/Unknown for missing input; label estimated 1RM, self-reported ratings and source timestamps. Never invent a readiness formula, PR, diagnostic claim or missing chart point.
- **Feature status:** page splitting is a design proposal. Verify exact mutations against current schemas and docs/MOBILE-PARITY.md before implementation. Full native parity remains unfinished.

## 7. State library

Include empty, loaded, loading, validation, saving, offline and recoverable-error variants for every applicable screen. Also create:

- Sync phase, record count, elapsed time, last success and retry. First sync may include the library; avoid a spinner with no explanation.
- Saved locally / waiting to sync, with logging still enabled.
- Conflict field comparison, including edit versus delete.
- Permission denied with useful explanation of what still works.
- Unsaved edits and explicit discard confirmation.
- Incomplete workout showing skipped/unlogged sets before finish.
- AI request failure preserving the question and local workout.
- Insufficient chart/history data without decorative invented numbers.
- Restore incompatibility/account mismatch and safety-copy/rollback outcomes.
- Expired login and account binding protection.
- Large text, long exercise names, long notes and keyboard-visible forms.
- System Google chooser, Health Connect, notification permission and document/share picker transitions. Do not imitate system authentication screens.

## 8. Google Stitch master prompt

Copy this block, then attach the catalog sections for each batch:

> Design Body OS 4.0, a premium Android training and skincare app used between sets in the gym. Create a cohesive linked prototype at 412 × 915, with responsive handling at 360 × 800. Use deep charcoal-green, warm-white text, restrained lime actions, mint skincare accents, spacious cards and 48dp targets. Use Today, Train, Progress, Care and More bottom tabs. Follow all screen IDs in appdesign.md; retain IDs in frame names. Distinguish full pages, sheets, card steps and states. Readiness and workout logging need beautiful left/right swipe cards plus visible Back/Next buttons and explicit Save/Log set actions. Preserve training, plans, library, programs, calendar, history, analytics, goals, body measurements, skincare, coaching, reports, settings, sync and backups. No nutrition, social feed, paywalls or claims of working camera analysis. Google login is one button with no Firebase settings. Include offline, error, empty, permissions, sync progress and conflict states. Mark sample data as prototype data. Use one shared component system across every batch. No dead-end primary actions.

## 9. Stitch production batches

1. Design tokens/components: buttons, inputs, card, sheet, navigation, chart and empty/error states. Approve B01, C06, E01 and G01 as style anchors.
2. All A and B frames: onboarding and complete readiness journey.
3. All C frames: weighted/reps/timed logging, rest, editing, resume and finish.
4. All D frames: plan/library/split/program/calendar flows.
5. All E and F frames: records, analytics, goals, body, coaching and reports.
6. All G frames: complete skincare workspace.
7. All H frames and state library, including conditional legacy screens.
8. Reconcile every ID against frames or documented shared variants. Add light-theme/large-text examples and link every primary CTA.

Reuse the same approved visual anchors throughout. Do not generate a different theme for each batch. A catalog row can need multiple frames: all states and create/edit variants count toward completeness.

## 10. Future camera concept — excluded from current parity

The user previously discussed live exercise analysis. It is not a current working feature. Do not place it in the main app as available. If separately requested later, design camera permission, exercise/angle selection, phone-positioning guide, visibility check, live view with occlusion/uncertainty, feedback and summary. It requires separate technical validation and must not claim universal form accuracy or injury detection.

## 11. Acceptance checklist

- All catalog IDs have frames or named shared variants; all 20 web pages are mapped.
- Offline entry and one-button Google login are represented.
- Readiness/workout cards navigate both directions without unintended data changes.
- Weighted, reps-only and timed sets have appropriate inputs.
- Advanced prescriptions, set types/sides, supersets, warm-ups, history and editing are reachable.
- Existing create/edit/delete/import/export capabilities have designs.
- Skincare, reporting, settings and recovery have complete flows, not placeholders.
- Missing data is honest; charts and scores carry units/date/source.
- Destructive actions explain their effects; no hidden account mixing or backup replacement.
- Prototype sample data never implies real device/cloud testing has passed.
- Implementation acceptance still needs real-phone, offline/restart, two-way sync and safe APK-upgrade tests.

## Audit basis

Inspected src/client/App.tsx, src/shared/workspaces.ts, the 20 page files under src/client/pages (including skin), page headings/actions, src/client/components/Onboarding.tsx, mobile component names and docs/MOBILE-PARITY.md. This specification expands the current areas into task-focused Android screens. It is a design brief, not an API contract or completion report.
