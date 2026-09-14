---
name: Body OS
colors:
  surface: '#0d141e'
  surface-dim: '#0d141e'
  surface-bright: '#333a45'
  surface-container-lowest: '#070e19'
  surface-container-low: '#151c27'
  surface-container: '#19202b'
  surface-container-high: '#232a35'
  surface-container-highest: '#2e3541'
  on-surface: '#dce3f2'
  on-surface-variant: '#c7c6cb'
  inverse-surface: '#dce3f2'
  inverse-on-surface: '#2a313c'
  outline: '#919095'
  outline-variant: '#46464b'
  surface-tint: '#c7c6cd'
  primary: '#c7c6cd'
  on-primary: '#2f3036'
  primary-container: '#111217'
  on-primary-container: '#7d7d83'
  inverse-primary: '#5e5e64'
  secondary: '#a8f530'
  on-secondary: '#213600'
  secondary-container: '#8ed800'
  on-secondary-container: '#395a00'
  tertiary: '#9dd841'
  on-tertiary: '#213600'
  tertiary-container: '#0a1500'
  on-tertiary-container: '#5c8a00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e3e1e9'
  primary-fixed-dim: '#c7c6cd'
  on-primary-fixed: '#1a1b20'
  on-primary-fixed-variant: '#46464c'
  secondary-fixed: '#abf834'
  secondary-fixed-dim: '#91db04'
  on-secondary-fixed: '#112000'
  on-secondary-fixed-variant: '#314f00'
  tertiary-fixed: '#b8f55b'
  tertiary-fixed-dim: '#9dd841'
  on-tertiary-fixed: '#121f00'
  on-tertiary-fixed-variant: '#324f00'
  background: '#0d141e'
  on-background: '#dce3f2'
  surface-variant: '#2e3541'
  canvas-dark: '#101115'
  surface-base: '#17191F'
  surface-elevated: '#1D2027'
  border-dark: '#2C3038'
  text-primary: '#F6F7F8'
  text-secondary: '#A7ADB7'
  text-muted: '#69707D'
  body-lime: '#9EEA22'
  lime-soft: '#DDF8AC'
  success: '#32C96D'
  warning: '#F2B541'
  danger: '#F26B6B'
  info: '#4D8EF7'
  gold-pr: '#FFD043'
typography:
  display-hero:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: 0em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-eyebrow:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.12em
  label-numeric-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.03em
  label-numeric-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  2xs: 0.25rem
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.25rem
  xl: 1.5rem
  2xl: 2rem
  3xl: 2.5rem
  gutter-mobile: 1rem
  gutter-tablet: 1.5rem
  screen-edge: 1rem
  dock-clearance: 5rem
---

## Brand & Style

This design system defines an elite, personal fitness operating system engineered for athletic clarity, clinical precision, and biometric sovereignty. Far removed from aggressive, gamified gym trackers and saturated "beast mode" clichés, it treats human physical training through the lens of high-performance telemetry: disciplined, local-first, private, and mathematically legible.

The aesthetic fuses modern terminal minimalism with refined executive sports telemetry. Deep, light-absorbing obsidian surfaces act as a neutral canvas, punctuated by crisp electric lime accents that direct focus exclusively to critical progress vectors, rest intervals, and kinetic achievements. Every pixel emphasizes functional hierarchy, immediate data absorption under physical strain, and tactile confidence.

## Colors

The palette operates on a high-contrast dark foundation. True blacks and near-black carbon shades eliminate visual noise in low-light gym environments and conserve OLED battery during prolonged workout tracking sessions. 

- **Primary (`#111217`)**: Dense obsidian serving as the structural anchor for tactile surfaces, cards, and modal sheets.
- **Secondary (`#9EEA22`)**: Electrified Body Lime used deliberately as an operational focus trigger. It commands interactive primacy—fueling workout start buttons, current set completions, PR achievements, and active navigation nodes.
- **Tertiary (`#B7F45A` / `#DDF8AC`)**: Softened variations of lime applied to chart fills, subtle telemetry halos, and secondary active states to preserve hierarchical balance without overwhelming the visual field.
- **Neutral (`#69707D`)**: Calibrated slate supporting secondary copy, structural metadata, and inactive vector states.

Semantic status colors (`#32C96D` success, `#F2B541` warning, `#F26B6B` danger) adhere strictly to clinical feedback standards, while personal records trigger an authoritative gold accent (`#FFD043`).

## Typography

The type architecture pairs `Manrope` for display and headline roles with `Hanken Grotesk` for systemic interface text, data sets, and clinical labels.

- **Headings & Telemetry (`Manrope`)**: Provides a technical, geometric gravity with punchy optical balance. Used ExtraBold (`800`) for top-level screen names, exercise titles, and large numerical readouts (such as barbell loads and rest timers).
- **Body & Data (`Hanken Grotesk`)**: Offers clean, contemporary legibility under rapid glance conditions. Its neutral horizontal proportions prevent eye fatigue across dense logging tables.
- **Section Eyebrows**: Set in strictly uppercase `label-eyebrow` styling with generous letter spacing (+12%) to establish crisp categorizations (`VOLUME LOAD`, `RECOVERY SCORE`, `CARDIAC STRAIN`) without requiring heavy dividers.

## Layout & Spacing

Layout geometry follows a disciplined 4dp base rhythm designed for high-dexterity tactile interaction on mobile devices.

- **Grid Framework**: Handheld layouts (360–430dp) employ a fluid single-column model bounded by 16dp screen-edge gutters. Tablets and foldables (≥840dp) reflow into a multi-column modular grid with 24dp gutters, swapping the mobile bottom navigation bar for an anchored left-hand navigation rail.
- **Rhythm Rules**: Sub-metric items and inline indicators maintain 4dp to 8dp gaps. Content cards utilize internal padding of 16dp to 20dp. Stacked sections leverage 24dp to 32dp gaps.
- **Safe Clearance**: Workouts demand instant utility access; layouts preserve an explicit 80dp bottom clearance (`dock-clearance`) to ensure persistent tracking strips and bottom dock actions never obscure the final data row.

## Elevation & Depth

Depth is established primarily through structural tonal stepping and razor-sharp 1px hairline perimeters rather than diffuse, muddy drop shadows.

- **Surface Tiers**:
  - **Level 0 (Canvas)**: `#101115` base viewport ground.
  - **Level 1 (Card & Containers)**: `#17191F` structural card layer framed by a crisp 1px stroke of `#2C3038`.
  - **Level 2 (Elevated Sheets & Dialogs)**: `#1D2027` with a fine perimeter highlight of `rgba(255, 255, 255, 0.08)`.
- **Luminous Overlays**: Select hero insights, readiness scores, and AI diagnostic panels utilize faint, non-skeuomorphic ambient gradients (`linear-gradient(135deg, rgba(158, 234, 34, 0.08) 0%, rgba(77, 142, 247, 0.06) 100%)`) layered behind translucent container backgrounds (`backdrop-filter: blur(12px)`).
- **Tactile Shadows**: Interactive floating action clusters employ a dark, concentrated occlusion shadow: `0 4px 16px rgba(0, 0, 0, 0.45)`.

## Shapes

The design system adopts a controlled `Rounded` profile (Level 2) with selective full-radius pill treatments for transient elements.

- **Small Components (Chips, Tags, Inputs)**: 8px (`0.5rem`) corner radius for dense, reliable touch areas.
- **Buttons & Tactical Triggers**: 12px to 14px radius, balancing athletic ergonomics with modern device forms.
- **Cards & Data Modules**: 16px (`1rem`) to 20px radius (`rounded-lg`), producing clear containment for dense metrics.
- **Bottom Sheets**: 24px (`1.5rem`, `rounded-xl`) top corner radii to emphasize modal layering over the underlying canvas.
- **Pills**: Infinite radius (`9999px`) reserved strictly for status badges (`PR`, `ACTIVE`, `TARGET`), segment controllers, and filter chips.

## Components

### Buttons
- **Primary CTA**: Background `#9EEA22`, text `#111217` (Manrope Bold, 15px), height 52px, border-radius 12px. Active press state initiates an immediate scale transform (`0.98`) with haptic impulse.
- **Secondary Action**: Background `#17191F`, border 1px solid `#2C3038`, text `#F6F7F8`. On press, border lightens to `rgba(255, 255, 255, 0.2)`.
- **Destructive**: Background `rgba(242, 107, 107, 0.12)`, border 1px solid `rgba(242, 107, 107, 0.3)`, text `#F26B6B`.

### Cards & Telemetry Containers
- Flat `#17191F` background, 1px `#2C3038` perimeter, 16px border-radius, internal padding 16px.
- Internal headers pair an uppercase eyebrow label with a trailing contextual icon or micro-sparkline.
- Key figures use `label-numeric-lg` paired with a secondary baseline unit label (`kg`, `reps`, `bpm`).

### Form Inputs & Numeric Steppers
- Height 48px, background `#101115`, border 1px solid `#2C3038`, radius 10px, text `#F6F7F8`.
- Focus state activates a 1px `#9EEA22` glow border without layout shift.
- Barbell/weight steppers integrate tactile `+` and `-` boundary buttons with a centered tabular numeric input.

### Chips & Segmented Controls
- **Segmented Control Bar**: Contained track in `#101115`, padding 4px, radius 9999px. Active selection chip transitions smoothly with a `#1D2027` background and white text.
- **Status Filter Chips**: Pill shape, border 1px solid `#2C3038`. Active state gains an accent dot in Body Lime (`#9EEA22`) and text color `#F6F7F8`.

### Navigation Dock & Sticky Rest Strip
- **Bottom Dock**: 5-tab bar anchored at 64px height above system navigation. Inactive icons `#69707D`, active state highlighted in `#9EEA22` with an ambient glow indicator dot.
- **Sticky Rest Strip**: Persistent tracking strip docked directly above the navigation bar during active sessions. Dark carbon container (`#111217`) housing rest-timer countdown, set checkoff toggle, and workout progress line.