# Verification inventory

The delivery is a running WebGL artwork, not the concept image in `concept.png`.

## Functional checks

- Ordinary → fracture → descent → revelation → loop → ordinary through visible controls.
- Two completed loops, keyboard return, direct monitor click, and working entry afterward.
- Scroll forward/back; Continue; touch drag; pointer parallax and the cursor echo.
- Sound off/on and M; starts only after a gesture. Audio unavailable must not block graphics.
- Reduce motion control, operating-system preference, and changes during travel.
- Escape / Back to surface from intermediate states, repeated rapid Enter clicks.
- Resize at ordinary, travel, and monitor; narrow portrait and short landscape.
- No WebGL support / lost context: readable ordinary page and actionable explanation.
- Hidden tab pauses the rail. No jump on resuming. Resource counts do not grow per loop.
- TypeScript and production build; state-machine invariants.

## Visual checks

- First view: whole ENTER, heading, settings, colophon inside viewport.
- First WebGL frame uses the exact page snapshot and matched perspective projection.
- Fracture preserves recognizable words and typography sections; no blackout.
- Architecture shows foreground/middle/background parallax and genuine letter thickness.
- Monitor contains the homepage with its current viewport aspect.
- Last loop frame fills viewport with the same homepage image before DOM resumes.
- UI stays readable over light/dark geometry; reduced motion avoids banking/parallax.

## Concept fidelity

Compare `concept.png` to browser screenshots: paper/ink/red palette; condensed two-line
headline; thin grid; arrow/subtitle at right; black centered ENTER; geometry and monitor.
Intentional adaptations: readable full-height desktop and stacked mobile layout instead
of the concept board's extremely wide crop; functional settings and travel controls;
procedural geometry instead of baked concept imagery. No concept bitmap is rendered
as the functioning interface.

## Verified on 2026-10-13

- WSL 2 Ubuntu, Node.js 24.21.0: TypeScript check and Vite production build pass.
- Node test suite: **9/9 pass**. Two complete state cycles, exact transition order,
  duplicate-input guards, bounded reversible travel, all-state reset, preserved
  loop history, and slower reduced-motion traversal.
- Real browser suite: **4/4 pass on the development server (43.7 s)** and
  **4/4 pass on the production preview (43.6 s)** using Windows Edge Chromium.
- Desktop: two full loops, first via a raycast click on the actual screen, second
  via keyboard; Enter works afterward; mute/M and Escape work; no console errors
  or unhandled page exceptions in the tested complete desktop journeys.
- Mobile emulation: real touch tap and CDP touch swipe, complete journey and
  return, portrait 390×844 and landscape 844×390. Essential controls remain inside
  the viewport. No page exceptions in the tested mobile journey.
- OS reduced-motion preference is reflected in the control. Manual preference
  switching during travel also completes the route.
- Disabling WebGL preserves the ordinary HTML page and shows an explanation.
  Deliberate `WEBGL_lose_context` triggers recovery UI; retry reloads successfully.
- Resizing during the second desktop descent (1440×900 → 1280×720) preserves the
  journey and updates the monitor. Texture count does not grow across two loops.
- Codex IAB was used for the initial interactive/visual check. Its touch dispatch
  is unsupported, and the persistent Node REPL could not resolve local modules
  (`EPERM`), so the supplementary repeatable Playwright suite ran through the CLI.
- During editing, one Vite HMR CSS reload error came from in-place source copying.
  Synchronization now uses rsync's atomic file replacement; fresh automated runs
  on both servers contain no runtime console errors.
- IAB development diagnostics observed 144 fps at DPR 1.0 in the sampled desktop
  scene, 52 draw calls during descent and 19 near the monitor, with two textures.
  These are local samples, not a cross-device performance guarantee.
- `git diff --check` passes. No deployment, push, or external publication performed.

## Visual evidence and fidelity ledger

The concept is a 1664×942 triptych with wide illustrative panels, not a literal
desktop viewport. Runtime screenshots use 1440×900, 1280×720, 390×844 and 844×390.
Both concept and saved runtime captures were inspected using `view_image`.

| Comparison | Evidence and result |
| --- | --- |
| Typography | `01-ordinary.jpg`: bold condensed two-line BROWSER / CEPTION preserved; full-height composition intentionally adds vertical breathing room. |
| Palette | Paper `#e9e8e2`, charcoal ink, and restrained red markers/route retained across DOM and world. |
| Layout and grid | Fine vertical and horizontal rules, right-side arrow/subtitle, centered black ENTER preserved. Portrait deliberately stacks these. |
| Arrow continuity | The DOM rasterizer omitted the flex-sized SVG. Repainting the measured native vector path fixed it; `02-fracture.jpg` and `05-loop.jpg` retain it. |
| Spatial material | `02-fracture.jpg` preserves whole text blocks while they bend; `03-descent.jpg` shows genuinely extruded letters and interlocking frames. |
| Recognition and loop | `04-revelation.jpg` shows the same homepage; `05-loop.jpg` shows the bezel almost outside the viewport as the page returns. |
| UI contrast | Small paper backings prevent black controls from disappearing over dark architecture. Fracture HUD waits until the paper has separated. |
| Responsive fit | `06-mobile.jpg`, `08-mobile-monitor.jpg`, `09-mobile-landscape.jpg`: corrected short-landscape heading/control collisions and removed the overlapping 3D wall inscription on portrait views. |
| Visible copy | Core concept wording preserved. Intentional supporting additions: experiment/colophon labels, accessible sound/motion labels, scene captions and travel/recovery controls. No unrelated navigation or marketing sections. |

All captures are in `docs/screenshots/`. The reference is `docs/concept.png`.
The implementation was checked against this direction for typography, copy,
palette, grid, spacing, arrows, entry interaction, architecture, and monitor.
The visual reference is not used as a background or a substitute for functioning UI.

## Practical limits

Physical phones, Safari/iOS, Firefox, unusually old GPUs, prolonged thermal load,
and subjective loudspeaker/headphone balance were not directly checked. Audio
activation and mute state were exercised; audible quality still benefits from a
human listening pass. Reduced motion retains slow forward travel rather than a
fully static alternative. Automated tests do not prove every possible size or
input timing; hidden-tab pause and final disposal also have source-level coverage.
The Three.js chunk emits Vite's size advisory (519.6 kB raw / 133.2 kB gzip);
the build succeeds and libraries are split from artwork and font data.
