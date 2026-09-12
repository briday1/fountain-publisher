# Editor interaction performance

This pass addresses sluggish scrolling, interaction and decorative backgrounds
on normal large/high-DPI monitors. It preserves the existing themes, background
choices, document rendering and browser-only compilation requirement.

## Changes

- PDF/FDX compilation, byte counting, beat-sheet exports and browser PDF parsing
  run in a dedicated browser worker for each tab. The UI imports only the small
  client, not Pyodide or the Python helpers. No server or UI-thread fallback.
- One active compiler request, bounded waiting work, stale background requests
  coalesced per consumer, and explicit exports ahead of pending previews.
  An active export keeps its captured snapshot; typing never terminates it.
  Worker initialization/job failures settle pending promises and allow retry.
- Source scroll events update existing overlays, gutter and current-line
  geometry once per frame. No source scan, classification, Preview mutation or
  selection change. Resizing updates existing geometry instead of rebuilding
  syntax HTML. Panel drag events coalesce to their latest coordinates.
- Scroll-only workspace recovery saves wait for a pause and an idle opportunity
  (where available). They cannot postpone the existing 120 ms edit backup.
  Explicit save/exit flush and clear-on-exit behavior remain intact.
- Decorative animation has one loop capped at 30 draws/second regardless of
  display refresh rate. Hidden tabs/panels, closed settings previews and
  PDF-covered backgrounds stop drawing. Reduced motion and speed zero still
  produce a static frame. Visibility/theme/size changes refresh cached geometry.
- Canvas bitmaps use at most 1.5 million pixels and 2048 pixels per edge. Tile
  grids have at most 900 tiles; contour sampling is bounded. These budgets may
  reduce decorative detail/density on very large displays without changing
  screenplay text resolution or stored background preferences.
- Moving dots use clipped, transform-only decorative layers. They no longer
  update inherited CSS properties/background-position on entire editor panels.
  Canvas drawing also avoids per-frame layout measurement and allocation-heavy
  tile/constellation loops.

## Reproducible checks

```shell
npm test
npm run build:web
npm run test:wasm
npm run benchmark:backgrounds -- --baseline=e0cded8
```

`e0cded8` is the pre-fix main commit. Timing comparisons must run on the same
machine and Node version; they are diagnostics, not portable speed guarantees.

Observed local measurements:

- An 86-page generated script occupied the old main thread for approximately
  380–465 ms with no timer heartbeats. The same production engine in a dedicated
  Node worker kept the test's main thread responsive (roughly 11–15 ms maximum
  heartbeat gap), with equal page count/usage metrics. Compilation itself is
  not necessarily faster: its CPU work is moved away from UI event handling.
- At a 2560×1440 CSS-pixel surface and 2× pixel ratio, maximum-density Tiles
  measured roughly 15 ms → 2 ms of JavaScript per draw, with 9,078 → 1,748
  rectangle operations and 14.75M → 1.50M backing pixels.
- A 200-event Source scroll burst over 5,000 lines produces one geometry frame,
  zero text reads/classifications and no Preview or selection mutations.

The background benchmark uses **no-op canvas methods**: it excludes actual
painting, layout, compositing and GPU cost. The worker measurement uses actual
Pyodide/Python and the shipped worker protocol in Node, **not a browser frame
trace**. These results do not certify browser typing latency or a universal FPS.

## Native-browser acceptance still required

No browser was connected during implementation. On the affected browser/monitor:

1. Scroll long scripts in Source and Preview while typing/exporting; verify
   selection, wrapped overlays, gutter and collaboration cursors remain aligned.
2. Exercise all backgrounds, maximum density, static/reduced-motion modes and
   the settings preview at ordinary, Retina, 4K/5K and high-refresh resolutions.
   Check pattern sharpness, clipping, layer order and motion pacing.
3. Switch Source/Preview/PDF/Beats, resize/zoom/enter Zen, change themes, hide and
   resume the tab. Record frame times, long tasks and paint cost.
4. Test worker asset loading after upgrade/offline caching, startup failures,
   suspended tabs and simultaneous local exports in two collaborative tabs.
5. Check mobile recovery around pagehide/app termination: existing lifecycle
   backup uses beforeunload, which mobile browsers do not always deliver. This
   pass does not add a persistent CRDT outbox or claim crash-proof recovery.

No Cloudflare configuration, collaboration protocol, storage migration or new
dependency is required by this performance change.
