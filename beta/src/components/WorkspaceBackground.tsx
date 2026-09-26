import { type CSSProperties, memo, useEffect, useRef, useState } from "react";
import "./workspace-background.css";

import {
  defaultBackgroundOptions,
  densityFactors,
  speedFactors,
  type BackgroundOptions,
  type WorkspacePattern,
} from "./backgroundPreferences";
export type { WorkspacePattern } from "./backgroundPreferences";

// The contour geometry is shared between mounts. Moving this one SVG layer
// keeps terrain animation off the editing thread and avoids repainting paths.
const contourPaths = new Map<BackgroundOptions["density"], string>();
function getContours(density: BackgroundOptions["density"]) {
  const cached = contourPaths.get(density);
  if (cached !== undefined) return cached;
  const step = 12;
  const columns = 84;
  const rows = 68;
  const height = (x: number, y: number) =>
    Math.sin(x * 0.006 + Math.sin(y * 0.008) * 1.4) +
    0.7 * Math.cos(y * 0.009 + x * 0.003) +
    0.45 * Math.sin(x * 0.013 - y * 0.006);
  const values = Array.from({ length: rows + 1 }, (_, y) =>
    Array.from({ length: columns + 1 }, (_, x) => height(x * step, y * step)),
  );
  const segments: string[] = [];
  for (let level = -1.9; level < 2; level += 0.19 / densityFactors[density]) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const corners = [
          [x * step, y * step, values[y][x]],
          [(x + 1) * step, y * step, values[y][x + 1]],
          [(x + 1) * step, (y + 1) * step, values[y + 1][x + 1]],
          [x * step, (y + 1) * step, values[y + 1][x]],
        ];
        const crossings: number[][] = [];
        for (let edge = 0; edge < 4; edge++) {
          const a = corners[edge];
          const b = corners[(edge + 1) % 4];
          if (a[2] > level === b[2] > level) continue;
          const fraction = (level - a[2]) / (b[2] - a[2]);
          crossings.push([
            a[0] + (b[0] - a[0]) * fraction,
            a[1] + (b[1] - a[1]) * fraction,
          ]);
        }
        if (crossings.length === 4) {
          const center = corners.reduce((sum, p) => sum + p[2], 0) / 4;
          if (center > level !== corners[0][2] > level) {
            crossings.push(crossings.shift()!);
          }
        }
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const a = crossings[i];
          const b = crossings[i + 1];
          segments.push(
            `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`,
          );
        }
      }
    }
  }
  const path = segments.join("");
  contourPaths.set(density, path);
  return path;
}

interface Star {
  x: number;
  y: number;
  depth: number;
}

function Hyperspace({
  running,
  options,
}: {
  running: boolean;
  options: BackgroundOptions;
}) {
  const speed = useRef(speedFactors[options.speed]);
  const setDensity = useRef<(density: number) => void>(() => {});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setRunning = useRef<(active: boolean) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let active = false;
    let frame = 0;
    let lastPaint = 0;
    let color = getComputedStyle(canvas).color;
    let stars: Star[] = [];
    let starDensity = 1;
    const seedStar = (depth = 1): Star => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      depth,
    });

    function paint(delta: number) {
      if (!context || !canvas || !width || !height) return;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.globalAlpha = 0.38;
      context.lineWidth = 1.15;
      context.lineCap = "round";
      context.beginPath();
      const centerX = width / 2;
      const centerY = height * 0.46;
      for (const star of stars) {
        star.depth -= delta * 0.075 * speed.current;
        let x = (star.x * width * 0.45) / Math.max(0.01, star.depth);
        let y = (star.y * height * 0.45) / Math.max(0.01, star.depth);
        if (
          star.depth <= 0.035 ||
          Math.abs(x) > width * 0.6 ||
          Math.abs(y) > height * 0.65
        ) {
          Object.assign(star, seedStar());
          x = star.x * width * 0.45;
          y = star.y * height * 0.45;
        }
        const trail = 1 - star.depth / (star.depth + 0.018);
        context.moveTo(centerX + x * (1 - trail), centerY + y * (1 - trail));
        context.lineTo(centerX + x, centerY + y);
      }
      context.stroke();
    }

    function tick(now: number) {
      frame = 0;
      if (!active || !width || !height) return;
      if (!lastPaint || now - lastPaint >= 1000 / 30) {
        paint(lastPaint ? Math.min((now - lastPaint) / 1000, 0.1) : 0);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    }

    function resume() {
      if (active && width && height && !frame) {
        frame = requestAnimationFrame(tick);
      }
    }

    function resize() {
      if (!canvas || !context) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // Bound both density and total pixels even on large retina displays.
      const density = Math.min(
        window.devicePixelRatio || 1,
        1.5,
        Math.sqrt(1_800_000 / Math.max(1, width * height)),
      );
      canvas.width = Math.max(1, Math.round(width * density));
      canvas.height = Math.max(1, Math.round(height * density));
      context.setTransform(
        canvas.width / Math.max(1, width),
        0,
        0,
        canvas.height / Math.max(1, height),
        0,
        0,
      );
      const count = Math.max(
        24,
        Math.min(
          225,
          Math.round(
            Math.min(150, Math.max(48, (width * height) / 7000)) * starDensity,
          ),
        ),
      );
      stars = stars.slice(0, count);
      while (stars.length < count)
        stars.push(seedStar(0.12 + Math.random() * 0.88));
      paint(0);
      resume();
    }

    setDensity.current = (next) => {
      starDensity = next;
      resize();
    };
    setRunning.current = (next) => {
      active = next;
      lastPaint = 0;
      if (!active && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      resume();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // CSS colors update without remounting or reinitializing the star field.
    const themeObserver = new MutationObserver(() => {
      color = getComputedStyle(canvas).color;
      paint(0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    window.addEventListener("resize", resize);
    resize();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      setRunning.current = () => {};
      setDensity.current = () => {};
    };
  }, []);

  useEffect(() => {
    speed.current = speedFactors[options.speed];
  }, [options.speed]);
  useEffect(
    () => setDensity.current(densityFactors[options.density]),
    [options.density],
  );
  useEffect(() => setRunning.current(running), [running]);

  return <canvas ref={canvasRef} className="workspace-background-stars" />;
}

export const WorkspaceBackground = memo(function WorkspaceBackground({
  pattern,
  paused = false,
  options = defaultBackgroundOptions,
}: {
  pattern: WorkspacePattern;
  paused?: boolean;
  options?: BackgroundOptions;
}) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    if (pattern === "plain") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!motion.matches && !document.hidden);
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pattern]);

  if (pattern === "plain") return null;
  const running = motionAllowed && !paused && options.animated;
  const spacing = 24 / Math.sqrt(densityFactors[options.density]);
  const style = {
    "--workspace-dot-spacing": `${spacing}px`,
    "--workspace-dots-duration": `${28 / speedFactors[options.speed]}s`,
    "--workspace-terrain-duration": `${48 / speedFactors[options.speed]}s`,
  } as CSSProperties;
  return (
    <div
      className="workspace-background"
      style={style}
      data-pattern={pattern}
      data-running={running}
      aria-hidden="true"
    >
      {pattern === "dots" && <div className="workspace-background-dots" />}
      {pattern === "topographic" && (
        <svg
          className="workspace-background-contours"
          viewBox="0 0 1008 816"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <path
            d={getContours(options.density)}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {pattern === "hyperspace" && (
        <Hyperspace running={running} options={options} />
      )}
    </div>
  );
});
