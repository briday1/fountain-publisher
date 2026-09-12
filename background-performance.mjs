// Decorative effects must leave time and memory for the editor. Keep these
// limits independent from refresh rate, device pixel ratio and display size.
export const BACKGROUND_FPS = 30;
export const BACKGROUND_PIXEL_BUDGET = 1_500_000;

export function backgroundBitmapSize(width, height, pixelRatio = 1) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const ratio = Math.min(Math.max(1, pixelRatio), 2, 2048 / width, 2048 / height,
    Math.sqrt(BACKGROUND_PIXEL_BUDGET / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
  };
}

export function backgroundElementVisible(element, documentHidden = false) {
  if (documentHidden || element.closest("[hidden], dialog:not([open])")) return false;
  // Also covers CSS-only mobile tabs and display:none ancestors.
  return element.getClientRects().length > 0;
}

export function backgroundTileGrid(width, height, density) {
  let unit = Math.max(24, 46 / Math.sqrt(density / 100));
  let columns = Math.ceil(width / unit) + 2;
  let rows = Math.ceil(height / unit) + 2;
  while (columns * rows > 900) {
    unit *= 1.05;
    columns = Math.ceil(width / unit) + 2;
    rows = Math.ceil(height / unit) + 2;
  }
  return { unit, columns, rows };
}

// A single loop owns the selected effect. start() draws static previews once;
// stop() leaves the last frame intact and invalidates already-queued callbacks.
export function createBackgroundLoop({ requestFrame, cancelFrame, fps = BACKGROUND_FPS }) {
  let frame = 0;
  let generation = 0;
  let previousTime = null;
  let elapsed = 0;
  const interval = 1000 / fps;
  function stop() {
    generation += 1;
    if (frame) cancelFrame(frame);
    frame = 0;
    previousTime = null;
  }
  function start(draw, { animated = true } = {}) {
    stop();
    const current = generation;
    draw(elapsed, 0);
    if (!animated || current !== generation) return;
    const tick = (time) => {
      if (current !== generation) return;
      if (previousTime === null) previousTime = time;
      const delta = time - previousTime;
      if (delta + .1 >= interval) {
        const dt = Math.min(delta / 1000, .1);
        elapsed += dt * 1000;
        previousTime = time;
        draw(elapsed, dt);
      }
      if (current === generation) frame = requestFrame(tick);
    };
    frame = requestFrame(tick);
  }
  return { start, stop };
}
