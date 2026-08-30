// node_modules/@zakkster/lite-color/Color.js
var toCssOklch = ({ l, c, h, a = 1 }) => `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)} / ${a})`;
var NUM = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?";
var OKLCH_RE = new RegExp(
  "^\\s*oklch\\(\\s*(none|" + NUM + "%?)\\s+(none|" + NUM + "%?)\\s+(none|" + NUM + "(?:deg|rad|grad|turn)?)(?:\\s*/\\s*(none|" + NUM + "%?))?\\s*\\)\\s*$",
  "i"
);
var DEG2RAD = Math.PI / 180;

// node_modules/@zakkster/lite-rain/RainEngine.js
var VERSION = "1.4.0";
var MAX_PARTICLES = 2e6;
var MAX_FALL_LIFE = 12;
var TAU = Math.PI * 2;
var GUST_HZ = TAU / 3;
var RIPPLE_SLOTS = 64;
var RIPPLE_MASK = RIPPLE_SLOTS - 1;
var RIPPLE_LIFE0 = 0.6;
var RIPPLE_R0 = 2;
var RIPPLE_GROWTH = 60;
var FINITE_KEYS = [
  "gravity",
  "wind",
  "maxSpeed",
  "blurStrength",
  "splashBounce",
  "splashSpread",
  "splashLifeMin",
  "splashLifeMax",
  "density",
  "splashScale",
  "gust",
  "gustRate"
];
function isFiniteNumber(v) {
  return typeof v === "number" && v - v === 0;
}
var RainEngine = class {
  constructor(maxParticles = 8e3, config = {}) {
    if (!Number.isInteger(maxParticles) || maxParticles < 1 || maxParticles > MAX_PARTICLES) {
      throw new RangeError(
        "RainEngine: maxParticles must be an integer in [1, " + MAX_PARTICLES + "], got " + maxParticles
      );
    }
    this.max = maxParticles;
    this.config = {
      gravity: 1500,
      wind: 200,
      density: 5,
      maxSpeed: 2500,
      // FIX 3: Terminal velocity bound
      blurStrength: 0.04,
      // FIX 4: Exposed motion blur scalar
      splashBounce: 0.25,
      splashSpread: 200,
      splashLifeMin: 0.1,
      splashLifeMax: 0.3,
      splashScale: 1.2,
      // R-10: splash base radius scalar (was hardcoded 1.2)
      angle: null,
      gust: 0,
      // R3: wind-gust amplitude (0 = off)
      gustRate: Math.fround(GUST_HZ),
      // R3: gust oscillator frequency rad/s
      floorY: null,
      // R3: splash floor Y; null = use h
      splashDroplets: 0,
      // R3: extra droplets per impact (0..3)
      ripples: false,
      // R3: ground ripple rings (strict bool)
      color: "oklch(0.95 0.05 250)",
      rng: Math.random,
      ...config
    };
    for (let k = 0; k < FINITE_KEYS.length; k++) {
      const key = FINITE_KEYS[k];
      if (!isFiniteNumber(this.config[key])) {
        throw new RangeError(
          "RainEngine: config." + key + " must be a finite number, got " + this.config[key]
        );
      }
    }
    if (this.config.angle !== null && !isFiniteNumber(this.config.angle)) {
      throw new RangeError(
        "RainEngine: config.angle must be a finite number or null, got " + this.config.angle
      );
    }
    if (this.config.floorY !== null && !isFiniteNumber(this.config.floorY)) {
      throw new RangeError(
        "RainEngine: config.floorY must be a finite number or null, got " + this.config.floorY
      );
    }
    if (!Number.isInteger(this.config.splashDroplets) || this.config.splashDroplets < 0 || this.config.splashDroplets > 3) {
      throw new RangeError(
        "RainEngine: config.splashDroplets must be an integer in [0, 3], got " + this.config.splashDroplets
      );
    }
    if (typeof this.config.ripples !== "boolean") {
      throw new RangeError(
        "RainEngine: config.ripples must be a boolean, got " + this.config.ripples
      );
    }
    this.colorStr = typeof this.config.color === "string" ? this.config.color : toCssOklch(this.config.color);
    this.x = new Float32Array(this.max);
    this.y = new Float32Array(this.max);
    this.vx = new Float32Array(this.max);
    this.vy = new Float32Array(this.max);
    this.z = new Float32Array(this.max);
    this.gz = new Float32Array(this.max);
    this.wz = new Float32Array(this.max);
    this.bucket = new Uint8Array(this.max);
    this.radius = new Float32Array(this.max);
    this.tailMult = new Float32Array(this.max);
    this.life = new Float32Array(this.max);
    this.state = new Uint8Array(this.max);
    this._destroyed = false;
    this._lastW = 0;
    this._lastH = 0;
    this._areaModifier = 0;
    this._spawnCursor = 0;
    this._streakIdx = [
      new Uint32Array(this.max),
      new Uint32Array(this.max),
      new Uint32Array(this.max)
    ];
    this._streakCount = new Uint32Array(3);
    this._splashIdx = new Uint32Array(this.max);
    this._splashCount = 0;
    this._buckets = [
      { id: 0, zAvg: 0.3 },
      { id: 1, zAvg: 0.55 },
      { id: 2, zAvg: 0.9 }
    ];
    this._elapsed = 0;
    if (this.config.ripples === true) {
      this._rippleX = new Float32Array(RIPPLE_SLOTS);
      this._rippleR = new Float32Array(RIPPLE_SLOTS);
      this._rippleLife = new Float32Array(RIPPLE_SLOTS);
    } else {
      this._rippleX = null;
      this._rippleR = null;
      this._rippleLife = null;
    }
    this._rippleHead = 0;
  }
  spawn(dt, w, h) {
    if (this._destroyed) return;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.1) dt = 0.1;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    if (w !== this._lastW || h !== this._lastH) {
      this._lastW = w;
      this._lastH = h;
      this._areaModifier = w * h / 1e5;
    }
    const targetSpawns = Math.floor(this._areaModifier * this.config.density * (dt * 60));
    if (targetSpawns <= 0) return;
    const g = this.config.gravity;
    const wind = this.config.wind;
    const angle = this.config.angle;
    const rng = this.config.rng;
    const blurStrength = this.config.blurStrength;
    const angled = angle !== null;
    const cosA = angled ? Math.cos(angle) : 0;
    const sinA = angled ? Math.sin(angle) : 0;
    const speedBase = angled ? g * 0.5 : 0;
    const windOffset = g !== 0 ? Math.min(h / g * Math.abs(wind), w) : 0;
    const spawnWidth = w + windOffset * 2;
    const max = this.max;
    let spawned = 0;
    let cursor = this._spawnCursor;
    for (let n = 0; n < max; n++) {
      const i = cursor;
      cursor = cursor + 1;
      if (cursor >= max) cursor = 0;
      if (this.state[i] !== 0) continue;
      this.state[i] = 1;
      this.x[i] = rng() * spawnWidth - windOffset;
      this.y[i] = -50 - rng() * 100;
      const z = 0.2 + rng() * 0.8;
      this.z[i] = z;
      this.gz[i] = g * z;
      this.wz[i] = wind * z;
      this.bucket[i] = z < 0.4 ? 0 : z < 0.7 ? 1 : 2;
      this.tailMult[i] = blurStrength * z;
      this.life[i] = MAX_FALL_LIFE;
      if (angled) {
        const speed = speedBase * z;
        this.vx[i] = cosA * speed;
        this.vy[i] = sinA * speed;
      } else {
        this.vx[i] = this.wz[i];
        this.vy[i] = this.gz[i] * 0.5;
      }
      if (++spawned >= targetSpawns) break;
    }
    this._spawnCursor = cursor;
  }
  updateAndDraw(ctx, dt, w, h) {
    if (this._destroyed) return;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.1) dt = 0.1;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const angle = this.config.angle;
    const angled = angle !== null;
    const maxSpeed = this.config.maxSpeed;
    const splashBounce = this.config.splashBounce;
    const splashSpread = this.config.splashSpread;
    const splashLifeMin = this.config.splashLifeMin;
    const splashLifeMax = this.config.splashLifeMax;
    const splashScale = this.config.splashScale;
    const rng = this.config.rng;
    const invSplashLifeMax = 1 / splashLifeMax;
    const gust = this.config.gust;
    const gustRate = this.config.gustRate;
    const floorY = this.config.floorY;
    const splashDroplets = this.config.splashDroplets;
    const fy = floorY !== null ? floorY : h;
    const rippleX = this._rippleX;
    const rippleR = this._rippleR;
    const rippleLife = this._rippleLife;
    const max = this.max;
    this._elapsed += dt;
    let windPulse = 0;
    if (gust !== 0) windPulse = Math.sin(this._elapsed * gustRate) * gust * dt;
    const streak0 = this._streakIdx[0];
    const streak1 = this._streakIdx[1];
    const streak2 = this._streakIdx[2];
    const splashIdx = this._splashIdx;
    let c0 = 0, c1 = 0, c2 = 0, cs = 0;
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s === 0) continue;
      if (s === 1) {
        if (angled === false) {
          this.vx[i] += this.wz[i] * 0.5 * dt;
        }
        this.vx[i] += windPulse;
        this.vy[i] += this.gz[i] * dt;
        const terminalVel = maxSpeed * this.z[i];
        if (this.vy[i] > terminalVel) this.vy[i] = terminalVel;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        if (this.y[i] >= fy) {
          this.y[i] = fy;
          this.state[i] = 2;
          this.radius[i] = this.z[i] * (splashScale + Math.abs(this.vy[i]) / 2e3);
          this.vy[i] = -this.vy[i] * splashBounce * rng();
          this.vx[i] = (rng() - 0.5) * splashSpread * this.z[i];
          this.life[i] = splashLifeMin + rng() * (splashLifeMax - splashLifeMin);
          splashIdx[cs++] = i;
          if (splashDroplets !== 0) {
            let cur = this._spawnCursor;
            for (let d = 0; d < splashDroplets; d++) {
              let j = -1;
              for (let n = 0; n < max; n++) {
                const cand = cur;
                cur = cur + 1;
                if (cur >= max) cur = 0;
                if (this.state[cand] === 0) {
                  j = cand;
                  break;
                }
              }
              if (j === -1) break;
              this.state[j] = 2;
              this.z[j] = this.z[i];
              this.gz[j] = this.gz[i];
              this.x[j] = this.x[i];
              this.y[j] = fy;
              this.vx[j] = (rng() - 0.5) * splashSpread * this.z[i];
              this.vy[j] = this.vy[i] * rng();
              this.radius[j] = this.z[i] * splashScale * 0.5;
              this.life[j] = splashLifeMin + rng() * (splashLifeMax - splashLifeMin);
              if (j <= i) splashIdx[cs++] = j;
            }
            this._spawnCursor = cur;
          }
          if (rippleX !== null) {
            const head = this._rippleHead;
            rippleX[head] = this.x[i];
            rippleR[head] = RIPPLE_R0 * this.z[i];
            rippleLife[head] = RIPPLE_LIFE0;
            this._rippleHead = head + 1 & RIPPLE_MASK;
          }
        } else if (!(this.x[i] >= -200 && this.x[i] <= w + 200 && this.y[i] >= -200)) {
          this.state[i] = 0;
        } else if ((this.life[i] -= dt) <= 0) {
          this.state[i] = 0;
        } else {
          const b = this.bucket[i];
          if (b === 0) streak0[c0++] = i;
          else if (b === 1) streak1[c1++] = i;
          else streak2[c2++] = i;
        }
      } else {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          this.state[i] = 0;
          continue;
        }
        this.vy[i] += this.gz[i] * dt;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        if (this.y[i] > fy) this.y[i] = fy;
        splashIdx[cs++] = i;
      }
    }
    this._streakCount[0] = c0;
    this._streakCount[1] = c1;
    this._streakCount[2] = c2;
    this._splashCount = cs;
    ctx.lineCap = "round";
    ctx.strokeStyle = this.colorStr;
    ctx.fillStyle = this.colorStr;
    const streakCount = this._streakCount;
    for (let bi = 0; bi < 3; bi++) {
      const bucket = this._buckets[bi];
      const list = this._streakIdx[bi];
      const count = streakCount[bi];
      ctx.globalAlpha = bucket.zAvg * 0.6;
      ctx.lineWidth = bucket.zAvg * 2;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const i = list[k];
        ctx.moveTo(this.x[i], this.y[i]);
        ctx.lineTo(this.x[i] - this.vx[i] * this.tailMult[i], this.y[i] - this.vy[i] * this.tailMult[i]);
      }
      ctx.stroke();
    }
    for (let k = 0; k < cs; k++) {
      const i = splashIdx[k];
      ctx.globalAlpha = this.life[i] * invSplashLifeMax * this.z[i];
      ctx.beginPath();
      ctx.arc(this.x[i], this.y[i], this.radius[i], 0, TAU);
      ctx.fill();
    }
    if (rippleX !== null) {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < RIPPLE_SLOTS; k++) {
        let lifeK = rippleLife[k];
        if (lifeK <= 0) continue;
        lifeK -= dt;
        if (lifeK <= 0) {
          rippleLife[k] = 0;
          continue;
        }
        rippleLife[k] = lifeK;
        const r = rippleR[k] + RIPPLE_GROWTH * dt;
        rippleR[k] = r;
        const rx = rippleX[k];
        ctx.moveTo(rx + r, fy);
        ctx.ellipse(rx, fy, r, r * 0.3, 0, 0, TAU);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  /**
   * O(max) live-particle count (state != 0). Test/debug telemetry for the
   * conservation invariant -- NOT for a hot path.
   */
  liveCount() {
    if (this._destroyed) return 0;
    const s = this.state;
    let n = 0;
    for (let i = 0; i < this.max; i++) if (s[i] !== 0) n++;
    return n;
  }
  clear() {
    if (this._destroyed) return;
    this.state.fill(0);
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clear();
    this.x = null;
    this.y = null;
    this.vx = null;
    this.vy = null;
    this.z = null;
    this.gz = null;
    this.wz = null;
    this.bucket = null;
    this.radius = null;
    this.tailMult = null;
    this.life = null;
    this.state = null;
    this._streakIdx = null;
    this._streakCount = null;
    this._splashIdx = null;
    this._rippleX = null;
    this._rippleR = null;
    this._rippleLife = null;
  }
};
var RAIN_PRESETS = Object.freeze({
  drizzle: Object.freeze({ gravity: 900, wind: 80, density: 2, maxSpeed: 1500 }),
  steady: Object.freeze({ gravity: 1500, wind: 200, density: 5 }),
  downpour: Object.freeze({ gravity: 2e3, wind: 350, density: 14, splashSpread: 260 }),
  storm: Object.freeze({
    gravity: 2200,
    wind: 1200,
    angle: 0.4,
    gust: 300,
    density: 22,
    splashSpread: 320
  })
});
export {
  MAX_PARTICLES,
  RAIN_PRESETS,
  RainEngine,
  VERSION
};
