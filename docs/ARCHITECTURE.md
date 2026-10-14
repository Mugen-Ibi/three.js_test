# BROWSERCEPTION

THE BROWSER IS NOT A WINDOW. IT IS A WORLD.

## One world, five states

`Journey` owns ordinary → fracture → descent → revelation → loop → ordinary.
It guards repeated activation and counts only completed returns. Escape resets
from every state. Progress is normalized and bounded, never a raw scroll offset.

1. **Ordinary** — semantic HTML, local Barlow Condensed and IBM Plex Mono,
   paper/ink/vermilion, a precise editorial grid. No 3D is exposed yet.
2. **Fracture** — `Surface` snapshots the current real DOM, cuts it at editorial
   seams, and maps those regions to subdivided Three.js planes. With FOV 48° and
   camera distance 12, the plane dimensions match CSS pixels exactly. A custom
   vertex shader bends the paper and propagates a wave from the click position.
   The camera holds back before passing through the original page plane.
3. **Descent** — a Catmull–Rom camera rail passes actual extruded letterforms,
   instanced lintels, floating browser panels and a red thread. Wheel, swipe and
   arrow keys adjust the destination; the rail also advances automatically.
   Pointer look is bounded. The original invention is a monumental cursor whose
   outline follows with a delay, making the visitor part of the architecture.
4. **Revelation** — the camera settles at a physical monitor on a plinth. Its
   screen reuses the homepage CanvasTexture. A raycaster handles screen clicks;
   a semantic button and Enter key provide equivalent access.
5. **Loop** — the camera aligns perpendicular to the monitor and moves to the
   exact fit distance `2.7 / tan(FOV / 2)`. Screen and viewport share their aspect.
   The DOM takes over at full coverage with no loading screen or black frame.
   On later visits the monumental cursor rotates further toward the observer.

## Responsibilities

- `main.ts`: renderer, lighting, camera rail, input, lifecycle, responsive sizing.
- `timeline.ts`: deterministic state machine and easing, independently tested.
- `surface.ts`: DOM capture, UV partitions, GLSL distortion, texture ownership.
- `world.ts`: actual geometry, material reuse, instancing, monitor and cursor echo.
- `audio.ts`: bounded Web Audio oscillators/noise/filter/echo. No audio downloads.
- `style.css`: responsive editorial surface, semantic controls, motion preferences.

## Performance and access

Ordinary does not render the 3D scene every frame. The WebGL world is compiled
before entry; the same scene and monitor survive every loop. DPR is capped and
falls after sustained slow frames. Shadows are omitted on initial narrow viewports
and disabled at the lowest quality. Objects share geometry/materials; capture
replaces and disposes the old texture. Unmount/pagehide disposes GPU/audio resources.
Visibility pauses the rail and silences audio. Resize updates projection, screen
aspect, and the DOM snapshot; it does not restart the journey.

Reduced motion uses a slower straight rail with no pointer parallax or banking,
much shallower page hinges, and no CSS/sound-bar animation. Preference changes
blend camera motion over time instead of changing transition durations. This
remains a spatial experience with forward motion; it is not a fully static mode.

WebGL failure preserves the readable HTML homepage and reports recovery steps.
All runtime assets are bundled locally. No analytics, remote fonts, accounts,
tracking, external audio, or backend are used.

## Sources and licenses

Implementation follows [Three.js documentation](https://threejs.org/docs/) and
[Vite documentation](https://vite.dev/guide/). Three.js and html-to-image are MIT;
Vite is MIT; Barlow and IBM Plex fonts are SIL OFL. Helvetiker carries the Magenta
font license. Runtime library/font notices are copied to `public/licenses/` and
included in the build. The `concept.png` board
was generated using the built-in image generation tool as a visual reference.
It is not a runtime image or a replacement for the rendered 3D scene.
