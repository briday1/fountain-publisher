const SAMPLE = `Title: The Last Light
Credit: Written by
Author: Avery Stone
Draft date: August 25, 2026

INT. OBSERVATORY - NIGHT

A telescope turns beneath the open dome. Stars burn over the sleeping city.

MAYA CHEN
(quietly)
There you are.

A red point of light moves against the constellations.

ELI
Tell me that's a satellite.

MAYA CHEN
It isn't.

EXT. CITY ROOFTOP - NIGHT

The skyline flickers. Every window goes dark at once.

ELI
That wasn't the grid.

Maya raises a battered field radio. Static answers her.

MAYA CHEN
The observatory has an independent circuit.
(then)
Something switched off the sky.

EXT. RIVERSIDE AVENUE - NIGHT

Traffic coasts to a silent halt. Drivers step into the street and stare upward.

JUNE PARK, 30s, pushes through the gathering crowd with a camera in hand.

JUNE PARK
Maya? If you can hear me, call back.

Her camera screen flares white. One frame remains: the red light, now impossibly close.

INT. OBSERVATORY - CONTROL ROOM - CONTINUOUS

Emergency lamps pulse along the floor. Eli studies a wall of dead monitors.

ELI
You said it was moving against the stars.

MAYA CHEN
No. The stars were moving around it.

The radio crackles.

JUNE PARK (V.O.)
Maya, look east.

EXT. CITY ROOFTOP - CONTINUOUS

Maya crosses to the dome opening. Beyond the river, a second red light rises.

Then a third.

MAYA CHEN
June, get underground.

JUNE PARK (V.O.)
What are they?

Maya watches the lights arrange themselves into a perfect line.

MAYA CHEN
An answer.

INT. OBSERVATORY - CONTROL ROOM - MOMENTS LATER

Eli drags a steel cabinet across the door. Maya tunes the radio through bands of static.

ELI
Please tell me the basement has more than canned peaches.

MAYA CHEN
It has a seismograph, two bicycles, and six hours of battery.

The radio snaps into sudden clarity.

MISSION CONTROL (V.O.)
Observatory Seven, report your sky.

Maya and Eli exchange a look.

MAYA CHEN
Three objects. Stationary over the river. All ground power is gone.

MISSION CONTROL (V.O.)
They aren't stationary.

EXT. RIVERSIDE AVENUE - NIGHT

June runs as the crowd surges toward the subway. Above them, the red lights stretch into glowing vertical lines.

A LITTLE BOY stands alone beside an abandoned bus.

JUNE PARK
Hey! Blue jacket! Come with me.

She takes his hand. A low vibration ripples through the pavement.

INT. OBSERVATORY - CONTROL ROOM - NIGHT

Ink needles jump across the seismograph. Eli tears off the paper.

ELI
That's not an earthquake.

MAYA CHEN
It's a signal.

She lays the paper beside an old star chart. The peaks align with three marked coordinates.

MAYA CHEN (CONT'D)
They've been here before.

INT. SUBWAY STATION - NIGHT

June guides the boy down a stalled escalator. Hundreds wait below in the emergency glow.

LITTLE BOY
My dad says stars are already gone when we see them.

JUNE PARK
Some are. Most are still fighting.

Her radio chirps.

MAYA CHEN (V.O.)
June, can your camera transmit?

JUNE PARK
For about nine minutes.

MAYA CHEN (V.O.)
I only need one.

EXT. OBSERVATORY DOME - PRE-DAWN

Maya bolts June's image sensor to the telescope while Eli pedals a bicycle generator below.

ELI
This is humiliating technology.

MAYA CHEN
Keep pedaling.

The telescope turns toward the nearest red line. On the monitor, darkness resolves into thousands of tiny mirrors.

ELI
What do they reflect?

Maya magnifies the image. In every mirror: the same blue planet beneath unfamiliar constellations.

MAYA CHEN
Home.

She keys the transmitter.

MAYA CHEN
If you can hear us, we are still here.

For a long beat, nothing.

Then the city lights return one block at a time, drawing a path toward the river.

INT. SUBWAY STATION - PRE-DAWN

Phones wake across the platform. June's camera begins to upload.

The little boy smiles at the ceiling as the vibration becomes a deep, harmonic chord.

EXT. CITY - DAWN

The red lines fold inward and vanish. Morning breaks across the skyline.

On the observatory roof, Maya finds one red point remaining in the brightening sky.

ELI
An answer?

MAYA CHEN
A promise.

>**END**<
`;

const BLANK_TEMPLATE = ``;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TITLE_KEYS = new Set(["title", "credit", "author", "authors", "source", "draft date", "date", "contact", "copyright", "notes"]);
const MANAGED_NOTE_RE = /^\[\[FP-(GENERAL|CHARACTER|BEATS):(.+)\]\]$/;
const source = $("#source");
const page = $("#screenplay-page");
const WORKSPACE_CACHE_KEY = "fountain-publisher.workspace.v1";
const GITHUB_BROWSER_KEY = "fountain-publisher.github-browser.v1";
const GITHUB_API = "https://api.fountain-publisher.com";
let STATIC_HOST = location.hostname.endsWith(".github.io") || new URLSearchParams(location.search).get("static") === "1";
let installPrompt = null;
const docSettings = {
  sceneNumbers: localStorage.getItem("fountain-publisher.scene-numbers") ?? "margin",
  sceneNumberFormat: localStorage.getItem("fountain-publisher.scene-number-format") ?? "sequential",
};
function setDocSetting(key, value) { docSettings[key] = value; localStorage.setItem(`fountain-publisher.${key}`, value); }
function sourceTabEnabled() {
  const stored = localStorage.getItem("fountain-publisher.source-tab");
  if (stored !== null) return stored === "true";
  return localStorage.getItem(WORKSPACE_CACHE_KEY) !== null || localStorage.getItem("fountain-publisher.preview") !== null;
}
const state = {
  filename: "Untitled.fountain",
  handle: null,
  savedSource: "",
  metadata: emptyMetadata(),
  compileTimer: 0,
  compileRevision: 0,
  compileController: null,
  insightTimer: 0,
  completionItems: [],
  completionIndex: 0,
  previewCompletionItems: [],
  previewCompletionIndex: 0,
  previewCompletionLine: null,
  previewMode: "live",
  livePreviewScrollTop: 0,
  livePreviewScrollLeft: 0,
  pdfUrl: null,
  insightLine: null,
  previewZoom: "100",
  history: [],
  historyIndex: -1,
  theme: localStorage.getItem("fountain-publisher.theme") || "system",
  cacheEnabled: false,
  cacheTimer: 0,
  noteEditor: null,
  previewContextLine: null,
  previewContextEdit: null,
  previewContextText: "",
  contextSurface: null,
  contextSelection: null,
  contextWord: null,
  spellchecker: null,
  spellcheckerPromise: null,
  githubConnected: false,
  githubInstallUrl: "",
  githubRepositories: [],
  githubBranches: [],
  githubRepositoryTimer: 0,
  githubColumns: [],
  githubFilesRevision: 0,
  githubBrowserMode: "open",
  githubRepository: "",
  githubBranch: "",
  githubPath: "",
  githubFile: null,
  vimEnabled: localStorage.getItem("fountain-publisher.vim-mode") === "true",
  vimMode: "normal",
  vimPending: "",
  vimVisualAnchor: 0,
  vimVisualFocus: 0,
  vimYank: "",
  vimYankLine: false,
  beatGuide: localStorage.getItem("fountain-publisher.beat-guide") === "true",
  activeBeat: 0,
  characterAnalyticsScene: null,
  browserLastPageEighths: 0,
  lastSourceValue: "",
};

function emptyMetadata() {
  return { lineCount: 1, wordCount: 0, dialogueWords: 0, actionWords: 0, estimatedSeconds: 0, characters: [], scenes: [], sections: [], locations: [], titleFields: [], generalNotes: [], characterNotes: {}, beatSheet: { line: null, premise: "", beats: [] }, lastPageEighths: 0 };
}

function readWorkspaceCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(WORKSPACE_CACHE_KEY) || "null");
    return cached?.version === 1 && typeof cached.source === "string" ? cached : null;
  } catch { return null; }
}

function persistWorkspaceNow() {
  if (!state.cacheEnabled) return;
  clearTimeout(state.cacheTimer);
  try {
    localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify({
      version: 1,
      source: source.value,
      filename: state.filename,
      savedSource: state.savedSource,
      selectionStart: source.selectionStart,
      selectionEnd: source.selectionEnd,
      sourceScrollTop: source.scrollTop,
      previewScrollTop: state.previewMode === "live" ? $("#preview-scroll").scrollTop : state.livePreviewScrollTop,
      previewScrollLeft: state.previewMode === "live" ? $("#preview-scroll").scrollLeft : state.livePreviewScrollLeft,
      previewMode: state.previewMode,
      zoom: state.previewZoom,
      githubFile: state.githubFile,
      updatedAt: Date.now(),
    }));
  } catch { /* Editing must continue even if private mode or quota blocks caching. */ }
}

function scheduleWorkspaceCache() {
  if (!state.cacheEnabled) return;
  clearTimeout(state.cacheTimer);
  state.cacheTimer = setTimeout(persistWorkspaceNow, 120);
}

function clearWorkspaceOnExit() {
  return localStorage.getItem("fountain-publisher.clear-workspace-on-exit") === "true";
}

function clearWorkspaceCache() {
  clearTimeout(state.cacheTimer);
  localStorage.removeItem(WORKSPACE_CACHE_KEY);
}

const DOT_DIRECTIONS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  "up-left": [-Math.SQRT1_2, -Math.SQRT1_2], "up-right": [Math.SQRT1_2, -Math.SQRT1_2],
  "down-left": [-Math.SQRT1_2, Math.SQRT1_2], "down-right": [Math.SQRT1_2, Math.SQRT1_2],
};
let dotMotionFrame = 0;
let dotMotionLastTime = 0;
let dotRandomChangedAt = 0;
let dotMotionVector = [0, 0];
let dotMotionTarget = [0, 0];
let dotOffset = [0, 0];
let dotMotionDirection = "still";
let dotMotionSpeed = 20;
let hyperspaceFrame = 0;
let hyperspaceLastTime = 0;
let hyperspaceSpeed = 20;
let hyperspaceDensity = 100;
let hyperspaceColors = false;
const hyperspaceFields = new WeakMap();

function backgroundSurfaces() {
  return [$("#preview-scroll"), $("#source-panel"), $("#beat-sheet-panel"), $("#background-pattern-preview")];
}

function hyperspaceCanvases() {
  return $$(".hyperspace-canvas");
}

function resetHyperspaceStar(star, initial = false) {
  star.x = Math.random() * 2 - 1;
  star.y = Math.random() * 2 - 1;
  star.z = initial ? Math.random() * .96 + .04 : 1;
  star.tint = Math.random();
}

function drawHyperspace(canvas, dt = 0) {
  if (canvas.closest("[hidden]")) return;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const ratio = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  let stars = hyperspaceFields.get(canvas);
  const targetCount = Math.max(20, Math.min(430, Math.round(width * height / 7000 * hyperspaceDensity / 100)));
  if (!stars || stars.length !== targetCount) {
    stars = Array.from({ length: targetCount }, () => { const star = {}; resetHyperspaceStar(star, true); return star; });
    hyperspaceFields.set(canvas, stars);
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) * .42;
  const velocity = .08 + hyperspaceSpeed / 125;
  const starColor = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#ffffff";
  const darkTheme = document.documentElement.dataset.effectiveTheme === "dark";
  const accentColors = darkTheme ? ["#a7e8ef", "#edb4d8", "#f2e3a4"] : ["#318d9a", "#ad5d91", "#9b842d"];
  for (const star of stars) {
    const previousZ = star.z;
    if (dt) star.z -= velocity * dt;
    let x = centerX + star.x / star.z * scale;
    let y = centerY + star.y / star.z * scale;
    if (star.z <= .025 || x < -30 || x > width + 30 || y < -30 || y > height + 30) {
      resetHyperspaceStar(star);
      x = centerX + star.x * scale;
      y = centerY + star.y * scale;
    }
    const tailZ = Math.min(1.08, previousZ + velocity * Math.max(dt, .012) * 2.4);
    const tailX = centerX + star.x / tailZ * scale;
    const tailY = centerY + star.y / tailZ * scale;
    const proximity = 1 - Math.min(1, star.z);
    const colorIndex = Math.min(2, Math.floor((star.tint - .82) / .06));
    const color = hyperspaceColors && star.tint >= .82 ? accentColors[colorIndex] : starColor;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.globalAlpha = .12 + proximity * .58;
    context.lineWidth = .55 + proximity * 1.7;
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(x, y);
    context.stroke();
    if (!dt) { context.beginPath(); context.arc(x, y, .55 + proximity, 0, Math.PI * 2); context.fill(); }
  }
  context.globalAlpha = 1;
}

function stopHyperspace(clear = true) {
  cancelAnimationFrame(hyperspaceFrame);
  hyperspaceFrame = 0;
  hyperspaceLastTime = 0;
  if (clear) hyperspaceCanvases().forEach((canvas) => canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height));
}

function startHyperspace(speed, density, colorsEnabled) {
  hyperspaceSpeed = speed;
  hyperspaceDensity = density;
  hyperspaceColors = colorsEnabled;
  stopHyperspace(false);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  hyperspaceCanvases().forEach((canvas) => drawHyperspace(canvas));
  if (reducedMotion || isMobilePreview()) return;
  const animate = (time) => {
    if (!hyperspaceLastTime) hyperspaceLastTime = time;
    const dt = Math.min((time - hyperspaceLastTime) / 1000, .05);
    hyperspaceLastTime = time;
    hyperspaceCanvases().forEach((canvas) => drawHyperspace(canvas, dt));
    hyperspaceFrame = requestAnimationFrame(animate);
  };
  hyperspaceFrame = requestAnimationFrame(animate);
}

function chooseRandomDotDirection() {
  const directions = Object.values(DOT_DIRECTIONS);
  let next = directions[Math.floor(Math.random() * directions.length)];
  if (directions.length > 1) while (next === dotMotionTarget) next = directions[Math.floor(Math.random() * directions.length)];
  dotMotionTarget = next;
}

function stopDotMotion(reset = false) {
  cancelAnimationFrame(dotMotionFrame);
  dotMotionFrame = 0;
  dotMotionLastTime = 0;
  if (reset) {
    dotOffset = [0, 0];
    backgroundSurfaces().forEach((surface) => {
      surface.style.setProperty("--preview-dot-x", "0px");
      surface.style.setProperty("--preview-dot-y", "0px");
    });
  }
}

function startDotMotion(direction, speed) {
  dotMotionSpeed = speed;
  if (dotMotionFrame && direction === dotMotionDirection) return;
  stopDotMotion(direction === "still");
  dotMotionDirection = direction;
  if (direction === "still" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (direction === "random") {
    chooseRandomDotDirection();
    dotMotionVector = [...dotMotionTarget];
    dotRandomChangedAt = performance.now();
  } else {
    dotMotionTarget = DOT_DIRECTIONS[direction] || DOT_DIRECTIONS.down;
    dotMotionVector = [...dotMotionTarget];
  }
  const animate = (time) => {
    if (!dotMotionLastTime) dotMotionLastTime = time;
    const dt = Math.min((time - dotMotionLastTime) / 1000, .1);
    dotMotionLastTime = time;
    if (direction === "random") {
      if (time - dotRandomChangedAt >= 60000) { chooseRandomDotDirection(); dotRandomChangedAt = time; }
      const ease = 1 - Math.exp(-dt / 6);
      dotMotionVector[0] += (dotMotionTarget[0] - dotMotionVector[0]) * ease;
      dotMotionVector[1] += (dotMotionTarget[1] - dotMotionVector[1]) * ease;
    }
    const pixelsPerSecond = dotMotionSpeed * .25;
    dotOffset[0] = (dotOffset[0] + dotMotionVector[0] * pixelsPerSecond * dt) % 16;
    dotOffset[1] = (dotOffset[1] + dotMotionVector[1] * pixelsPerSecond * dt) % 16;
    backgroundSurfaces().forEach((surface) => {
      surface.style.setProperty("--preview-dot-x", `${dotOffset[0].toFixed(2)}px`);
      surface.style.setProperty("--preview-dot-y", `${dotOffset[1].toFixed(2)}px`);
    });
    dotMotionFrame = requestAnimationFrame(animate);
  };
  dotMotionFrame = requestAnimationFrame(animate);
}

function applyPreviewBackground() {
  const storedPattern = localStorage.getItem("fountain-publisher.preview-background") || "dots";
  const pattern = ["blank", "dots", "hyperspace"].includes(storedPattern) ? storedPattern : "dots";
  const storedRadius = Number(localStorage.getItem("fountain-publisher.preview-dot-radius"));
  const radius = storedRadius >= .6 && storedRadius <= 1.8 ? storedRadius : 1;
  const storedDirection = localStorage.getItem("fountain-publisher.preview-dot-direction") || "still";
  const direction = storedDirection === "random" || storedDirection === "still" || DOT_DIRECTIONS[storedDirection] ? storedDirection : "still";
  const storedSpeed = Number(localStorage.getItem("fountain-publisher.preview-dot-speed"));
  const speed = storedSpeed >= 1 && storedSpeed <= 100 ? storedSpeed : 20;
  const storedDensity = Number(localStorage.getItem("fountain-publisher.preview-star-density"));
  const density = storedDensity >= 30 && storedDensity <= 240 ? storedDensity : 100;
  const colorsEnabled = localStorage.getItem("fountain-publisher.preview-star-colors") === "true";
  backgroundSurfaces().forEach((surface) => {
    surface.dataset.background = pattern;
    surface.style.setProperty("--preview-dot-radius", `${radius}px`);
  });
  $("#preview-background").value = pattern;
  $("#preview-dot-radius").value = String(radius);
  $("#preview-dot-radius-value").textContent = `${radius.toFixed(1)}px`;
  $("#preview-dot-radius-row").hidden = pattern !== "dots";
  $("#preview-dot-direction").value = direction;
  $("#preview-dot-speed").value = String(speed);
  $("#preview-dot-speed-value").textContent = String(speed);
  $("#preview-star-density").value = String(density);
  $("#preview-star-density-value").textContent = `${density}%`;
  $("#preview-star-colors").checked = colorsEnabled;
  $("#preview-dot-direction-row").hidden = pattern !== "dots";
  $("#preview-dot-speed-row").hidden = !["dots", "hyperspace"].includes(pattern);
  $("#preview-star-density-row").hidden = pattern !== "hyperspace";
  $("#preview-star-colors-row").hidden = pattern !== "hyperspace";
  if (pattern === "dots" && !isMobilePreview()) startDotMotion(direction, speed); else stopDotMotion(true);
  if (pattern === "hyperspace") startHyperspace(speed, density, colorsEnabled); else stopHyperspace();
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function fountainInlineHtml(value) {
  return escapeHtml(value)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<u>$1</u>");
}

function decodeNotePart(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function managedNote(line) {
  const match = line.trim().match(MANAGED_NOTE_RE);
  if (!match) return null;
  if (match[1] === "GENERAL") return { kind: "general", text: decodeNotePart(match[2]) };
  if (match[1] === "BEATS") {
    try {
      const value = JSON.parse(decodeNotePart(match[2]));
      const beats = Array.isArray(value.beats) ? value.beats.map((beat) => {
        const range = typeof beat === "object" && Number.isInteger(beat.range?.startLine) && Number.isInteger(beat.range?.endLine)
          ? { startLine: Math.max(0, beat.range.startLine), endLine: Math.max(beat.range.startLine, beat.range.endLine) }
          : null;
        return { text: typeof beat === "string" ? beat : String(beat.text || ""), range };
      }).filter((beat) => beat.text) : [];
      return { kind: "beats", premise: String(value.premise || ""), beats };
    } catch { return { kind: "beats", premise: "", beats: [] }; }
  }
  const separator = match[2].indexOf(":");
  if (separator < 0) return null;
  return {
    kind: "character",
    name: decodeNotePart(match[2].slice(0, separator)),
    text: decodeNotePart(match[2].slice(separator + 1)),
  };
}

function annotationText(raw) {
  return raw.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
}

function parseManagedNotes(lines) {
  const generalNotes = [];
  const characterNotes = {};
  let beatSheet = { line: null, premise: "", beats: [] };
  let boneyard = false;
  lines.forEach((raw, line) => {
    if (raw.includes("/*")) boneyard = true;
    if (boneyard) {
      if (raw.includes("*/")) boneyard = false;
      return;
    }
    const note = managedNote(raw);
    if (note?.kind === "general") generalNotes.push({ line, text: note.text });
    else if (note?.kind === "character") characterNotes[note.name] = { line, text: note.text };
    else if (note?.kind === "beats") beatSheet = { line, premise: note.premise, beats: note.beats };
  });
  return { generalNotes, characterNotes, beatSheet };
}

function isScene(text) {
  return /^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(text);
}

function cleanCharacter(text) {
  return text.replace(/^@/, "").replace(/\^$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function isCharacterCue(lines, index) {
  const text = lines[index].trim();
  if (!text || text.length > 45 || text.endsWith("TO:") || isScene(text)) return false;
  const forced = text.startsWith("@");
  const candidate = forced || /^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(text);
  const previousBlank = index === 0 || !lines[index - 1].trim();
  return candidate && previousBlank;
}

function classifyLines(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result = [];
  let titlePage = true;
  let titleFieldSeen = false;
  let titleContinuation = false;
  let dialogue = false;
  let boneyard = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    let type = "action";
    let display = raw;
    let prefix = "";
    if (trimmed.includes("/*")) boneyard = true;
    if (boneyard) type = "boneyard";
    else if (!trimmed) { type = "empty"; dialogue = false; if (titleFieldSeen) titlePage = false; titleContinuation = false; }
    else if (titlePage && /^[A-Za-z][A-Za-z ]+:/.test(raw) && TITLE_KEYS.has(raw.slice(0, raw.indexOf(":" )).trim().toLowerCase())) {
      const separator = raw.indexOf(":");
      prefix = raw.slice(0, separator + 1);
      display = raw.slice(separator + 1).trim();
      type = prefix.toLowerCase() === "title:" ? "title-value title" : "title-value";
      titleFieldSeen = true;
      titleContinuation = true;
      dialogue = false;
    } else if (titlePage && titleContinuation && /^\s+/.test(raw)) {
      display = trimmed;
      type = "title-value";
      dialogue = false;
    } else {
      titlePage = false;
      if (/^#{1,6}\s/.test(trimmed)) type = "section";
      else if (/^=/.test(trimmed) && !/^={3,}$/.test(trimmed)) type = "synopsis";
      else if (/^\[\[.*\]\]$/.test(trimmed)) type = "note";
      else if (/^~/.test(trimmed)) { type = "lyric"; display = raw.replace(/^\s*~/, ""); }
      else if (/^={3,}$/.test(trimmed)) type = "page-break";
      else if (isScene(trimmed)) { type = "scene"; dialogue = false; }
      else if (isCharacterCue(lines, i)) { type = "character"; display = trimmed.replace(/^@/, "").replace(/\^$/, ""); dialogue = true; }
      else if (dialogue && /^\(.*\)$/.test(trimmed)) type = "parenthetical";
      else if (dialogue) type = "dialogue";
      else if ((/^>.*<$/.test(trimmed))) { type = "centered"; display = trimmed.slice(1, -1).trim(); }
      else if (/^>/.test(trimmed) || (/^[A-Z0-9 .'-]+TO:$/.test(trimmed))) type = "transition";
      else if (trimmed.startsWith("!")) { type = "action"; display = raw.replace(/^\s*!/, ""); }
    }
    result.push({ raw, display, prefix, type, index: i });
    if (trimmed.includes("*/")) boneyard = false;
  }
  return result;
}

function analyzeLocally(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const typed = classifyLines(text);
  const notes = parseManagedNotes(lines);
  const characters = new Map();
  const scenes = [];
  const sections = [];
  const locations = new Set();
  const titleFields = [];
  let active = "";
  let currentScene = 0;
  let currentAct = "";
  let currentActNumber = 0;
  let dialogueWords = 0;
  let actionWords = 0;
  typed.forEach((line, index) => {
    const words = (line.display.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    if (line.prefix) titleFields.push(line.prefix.slice(0, -1));
    if (line.type === "section") {
      const match = line.raw.trim().match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        sections.push({ level: match[1].length, title: match[2], line: index + 1 });
        if (match[1].length === 1) { currentAct = match[2]; currentActNumber += 1; }
      }
    } else if (line.type === "scene") {
      const heading = line.display.replace(/^\./, "").replace(/\s+#[^#]+#\s*$/, "").toUpperCase();
      const number = line.display.match(/#([^#]+)#/)?.[1] || String(scenes.length + 1);
      scenes.push({ number, heading, line: index + 1, words: 0, act: currentAct || "Screenplay", actNumber: currentActNumber });
      currentScene = scenes.length;
      const location = heading.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i, "").split(/\s+-\s+/)[0].trim();
      if (location) locations.add(location);
      active = "";
    } else if (line.type === "character") {
      active = cleanCharacter(line.display);
      const entry = characters.get(active) || { name: active, cues: 0, lines: 0, words: 0, seconds: 0, sceneSet: new Set(), sceneLineMap: new Map(), lastLine: 0 };
      entry.cues += 1; entry.lastLine = index + 1; if (currentScene) entry.sceneSet.add(currentScene); characters.set(active, entry);
    } else if (line.type === "dialogue") {
      const entry = characters.get(active);
      if (entry) {
        entry.lines += 1; entry.words += words; dialogueWords += words;
        if (currentScene) entry.sceneLineMap.set(currentScene, (entry.sceneLineMap.get(currentScene) || 0) + 1);
      }
    } else if (!["empty", "parenthetical", "section", "synopsis", "note", "boneyard", "title-value", "title-value title"].includes(line.type)) {
      active = ""; actionWords += words; if (scenes.length) scenes.at(-1).words += words;
    }
  });
  const characterList = [...characters.values()].map((entry) => ({
    ...entry,
    seconds: Math.round(entry.words / 130 * 60),
    scenes: entry.sceneSet.size,
    sceneLines: [...entry.sceneLineMap].map(([scene, lineCount]) => ({ scene, lines: lineCount })),
    sceneSet: undefined,
    sceneLineMap: undefined,
  })).sort((a, b) => b.words - a.words || a.name.localeCompare(b.name));
  const wordCount = dialogueWords + actionWords;
  const pageCount = state.metadata?.pageCount ?? null;
  const lastPageEighths = state.metadata?.lastPageEighths ?? 0;
  return { lineCount: lines.length, wordCount, dialogueWords, actionWords, estimatedSeconds: pageCount == null ? 0 : pageCount * 60, characters: characterList, scenes, sections, locations: [...locations].sort(), titleFields, pageCount, lastPageEighths, ...notes };
}

function previewLineHtml(line, sceneLabel = null, annotation = null) {
  const centered = line.raw.trim().match(/^>\s*(.*?)\s*<$/);
  const act = line.type === "section" ? line.raw.trim().match(/^#\s+(Act\b.*)$/i) : null;
  const type = centered ? "centered" : line.type;
  const className = `script-line ${type}${act ? " act" : ""}`;
  let display = act?.[1] || line.display;
  const prefix = act ? "#" : line.prefix;
  if (centered) display = centered[1];
  else if (type === "transition" && line.raw.trim().startsWith(">")) display = line.raw.trim().slice(1).trimStart();
  if (sceneLabel !== null) {
    const cleanDisplay = line.display.replace(/^\./, "").replace(/\s+#[^#]+#\s*$/, "");
    display = docSettings.sceneNumbers === "inline" ? `${sceneLabel}. ${cleanDisplay}` : cleanDisplay;
  }
  const note = type === "note" ? managedNote(line.raw) : null;
  const content = display ? fountainInlineHtml(display) : "<br>";
  const sceneAttr = sceneLabel !== null ? escapeHtml(sceneLabel) : "";
  if (type === "note" && !note) return "";
  if (type === "note" && note) return `<div class="script-line note managed-note" data-line="${line.index}"></div>`;
  const orb = annotation
    ? `<button class="annotation-orb" type="button" data-annotation-line="${annotation.index}" title="${escapeHtml(annotation.text)}" aria-label="Edit annotation: ${escapeHtml(annotation.text)}"></button>`
    : "";
  const spellcheckAttr = type === "character" ? ` spellcheck="false"` : "";
  return `<div class="${className}" data-line="${line.index}" data-prefix="${escapeHtml(prefix)}" data-scene-number="${sceneAttr}" data-display="${escapeHtml(display)}"${spellcheckAttr}>${content}${orb}</div>`;
}

function annotationAfter(lines, index) {
  const next = lines[index + 1];
  return next?.type === "note" && !managedNote(next.raw) ? { index: next.index, text: annotationText(next.raw) } : null;
}

function computeSceneLabels(lines) {
  const labels = new Map();
  if (docSettings.sceneNumbers === "off") return labels;
  let sequential = 0; let actNum = 0; let actSceneNum = 0;
  const format = docSettings.sceneNumberFormat;
  for (const line of lines) {
    if (line.type === "section" && /^#\s/.test(line.raw.trimStart())) { actNum++; actSceneNum = 0; }
    else if (line.type === "scene") {
      sequential++; actSceneNum++;
      labels.set(line.index, format === "act" ? `A${Math.max(actNum, 1)}S${actSceneNum}` : String(sequential));
    }
  }
  return labels;
}

function renderPreviewLines(lines) {
  const sceneLabels = computeSceneLabels(lines);
  const output = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].type.startsWith("title-value")) {
      const titleLines = [];
      while (i < lines.length && (lines[i].type.startsWith("title-value") || lines[i].type === "empty")) {
        if (lines[i].type.startsWith("title-value")) titleLines.push(previewLineHtml(lines[i], null, annotationAfter(lines, i)));
        i += 1;
      }
      output.push(`<section class="title-page-block" aria-label="Title page fields">${titleLines.join("")}</section>`);
      i -= 1;
      continue;
    }
    if (lines[i].type === "character") {
      let next = i + 1;
      while (next < lines.length && ["dialogue", "parenthetical", "note"].includes(lines[next].type)) next += 1;
      while (next < lines.length && lines[next].type === "empty") next += 1;
      if (lines[next]?.type === "character" && lines[next].raw.trim().endsWith("^")) {
        let rightEnd = next + 1;
        while (rightEnd < lines.length && ["dialogue", "parenthetical", "note"].includes(lines[rightEnd].type)) rightEnd += 1;
        const leftLines = lines.slice(i, next).filter((line) => line.type !== "empty");
        const rightLines = lines.slice(next, rightEnd);
        const left = leftLines.map((line, index) => previewLineHtml(line, null, annotationAfter(leftLines, index))).join("");
        const right = rightLines.map((line, index) => previewLineHtml(line, null, annotationAfter(rightLines, index))).join("");
        output.push(`<div class="dual-dialog"><div class="dual-left">${left}</div><div class="dual-right">${right}</div></div>`);
        i = rightEnd - 1;
        continue;
      }
    }
    const label = sceneLabels.get(lines[i].index) ?? null;
    output.push(previewLineHtml(lines[i], label, annotationAfter(lines, i)));
  }
  return output.join("");
}

function alignAnnotationOrbs() {
  const orbs = $$(".annotation-orb", page);
  if (!orbs.length || page.hidden) return;
  const pageRect = page.getBoundingClientRect();
  if (!pageRect.width) return;
  const scale = pageRect.width / page.offsetWidth || 1;
  const paddingRight = parseFloat(getComputedStyle(page).paddingRight) || 0;
  const mobile = isMobilePreview();
  const marginCenterX = pageRect.right - paddingRight * scale * .5;
  const desktopX = pageRect.right - paddingRight * scale + 24 * scale;
  orbs.forEach((orb) => {
    const line = orb.closest(".script-line");
    if (!line) return;
    const targetX = mobile ? marginCenterX - orb.offsetWidth * scale * .5 : desktopX;
    orb.style.left = `${(targetX - line.getBoundingClientRect().left) / scale}px`;
  });
}

function revealPreviewEmptyRun(target, includePrevious = false) {
  $$(".script-line.empty.preview-empty-context", page).forEach((line) => line.classList.remove("preview-empty-context"));
  if (!target) return;
  const lines = classifyLines(source.value);
  const targetLine = Number(target.dataset.line);
  let start = target.classList.contains("empty") ? targetLine : includePrevious ? targetLine - 1 : -1;
  if (start < 0 || lines[start]?.type !== "empty") return;
  let end = start;
  while (start > 0 && lines[start - 1]?.type === "empty") start -= 1;
  while (end + 1 < lines.length && lines[end + 1]?.type === "empty") end += 1;
  for (let index = start; index <= end; index += 1) {
    $(`.script-line.empty[data-line="${index}"]`, page)?.classList.add("preview-empty-context");
  }
}

function insertPreviewDraftRow(target) {
  if (!target) return null;
  const targetLine = Number(target.dataset.line);
  const draftLine = targetLine - 1;
  if (draftLine < 0 || classifyLines(source.value)[draftLine]?.type !== "empty") return null;
  const existing = $(`.script-line.empty[data-line="${draftLine}"]`, page);
  if (existing) {
    existing.classList.add("preview-empty-context", "preview-draft-row");
    return existing;
  }
  const draft = document.createElement("div");
  draft.className = "script-line empty preview-empty-context preview-draft-row";
  draft.dataset.line = String(draftLine);
  draft.dataset.prefix = "";
  draft.dataset.display = "";
  draft.innerHTML = "<br>";
  (target.closest(".dual-dialog") || target).before(draft);
  return draft;
}

function renderPreview({ focusLine = null, focusOffset = null, revealEmptyBefore = false, draftBefore = false } = {}) {
  const lines = classifyLines(source.value);
  const previewScroll = $("#preview-scroll");
  const stage = $("#preview-page-stage");
  const scrollTop = previewScroll.scrollTop;
  const scrollLeft = previewScroll.scrollLeft;
  page.innerHTML = renderPreviewLines(lines);
  renderBeatGuide();
  page.spellcheck = $("#spellcheck").checked;
  const meaningful = lines.some((line) => line.raw.trim());
  $("#empty-state").hidden = meaningful;
  stage.hidden = state.previewMode !== "live";
  page.hidden = state.previewMode !== "live";
  if (focusLine !== null) {
    const target = $(`[data-line="${focusLine}"]`, page);
    target?.classList.add("source-current");
    if (draftBefore) insertPreviewDraftRow(target);
    else revealPreviewEmptyRun(target, revealEmptyBefore);
    page.focus({ preventScroll: true });
    if (target) {
      const offset = focusOffset ?? target.textContent.length;
      placeCaretAtOffset(target, offset);
      setSourceCursorFromPreview(target, offset);
    }
  }
  previewScroll.scrollTop = scrollTop;
  previewScroll.scrollLeft = scrollLeft;
  requestAnimationFrame(() => {
    previewScroll.scrollTop = scrollTop;
    previewScroll.scrollLeft = scrollLeft;
  });
  updatePreviewCursor(false, "nearest", revealEmptyBefore);
  applyZoom();
  requestAnimationFrame(alignAnnotationOrbs);
}

function placeCaretAtOffset(element, offset) {
  let remaining = Math.max(0, Math.min(offset, element.textContent.length));
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && remaining > node.textContent.length) {
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  if (node) range.setStart(node, remaining);
  else { range.selectNodeContents(element); range.collapse(false); }
  range.collapse(true);
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
}

function previewValueToSource(element, displayValue, originalValue = "") {
  let value = displayValue.replace(/\n/g, "");
  if (element.dataset.sceneNumber) {
    if (docSettings.sceneNumbers === "inline") {
      const prefix = element.dataset.sceneNumber + ". ";
      value = value.startsWith(prefix) ? value.slice(prefix.length) : value.replace(/^\s*(?:\d+|A\d+S\d+)\.\s+/, "");
    }
  }
  if (element.classList.contains("centered")) value = `> ${value} <`;
  else if (element.classList.contains("lyric")) value = `~${value}`;
  else if (element.classList.contains("character") && originalValue.trim().startsWith("@")) value = `@${value}`;
  else if (element.classList.contains("transition") && originalValue.trim().startsWith(">")) value = `>${value}`;
  else if (element.dataset.prefix) value = `${element.dataset.prefix} ${value}`;
  return value;
}

function fountainInlineSourceMap(value) {
  const removed = Array(value.length).fill(false);
  const closing = Array(value.length).fill(false);
  const markup = /(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;
  for (const match of value.matchAll(markup)) {
    const size = match[1].length;
    for (let index = match.index; index < match.index + size; index += 1) removed[index] = true;
    for (let index = match.index + match[0].length - size; index < match.index + match[0].length; index += 1) {
      removed[index] = true;
      closing[index] = true;
    }
  }
  const visible = removed.flatMap((hidden, sourceOffset) => hidden ? [] : [sourceOffset]);
  const startMap = Array.from({ length: visible.length + 1 }, (_, offset) => offset < visible.length ? visible[offset] : (visible.at(-1) ?? -1) + 1);
  const endMap = Array.from({ length: visible.length + 1 }, (_, offset) => offset ? visible[offset - 1] + 1 : (visible[0] ?? 0));
  const caretMap = Array.from({ length: visible.length + 1 }, (_, offset) => {
    let sourceOffset = offset ? visible[offset - 1] + 1 : 0;
    const nextVisible = offset < visible.length ? visible[offset] : value.length;
    while (sourceOffset < nextVisible && closing[sourceOffset]) sourceOffset += 1;
    return sourceOffset;
  });
  return { startMap, endMap, caretMap };
}

function previewSourceBody(element, originalValue) {
  let start = 0;
  let end = originalValue.length;
  const trimmedStart = originalValue.search(/\S|$/);
  if (element.classList.contains("centered")) {
    start = originalValue.indexOf(">", trimmedStart) + 1;
    if (originalValue[start] === " ") start += 1;
    const close = originalValue.lastIndexOf("<");
    end = close < start ? end : close;
    if (originalValue[end - 1] === " ") end -= 1;
  } else if (element.classList.contains("lyric")) {
    start = originalValue.indexOf("~", trimmedStart) + 1;
  } else if (element.classList.contains("character") && originalValue.slice(trimmedStart).startsWith("@")) {
    start = trimmedStart + 1;
  } else if (element.classList.contains("transition") && originalValue.slice(trimmedStart).startsWith(">")) {
    start = trimmedStart + 1;
    while (originalValue[start] === " ") start += 1;
  } else if (element.dataset.prefix) {
    const prefixStart = originalValue.indexOf(element.dataset.prefix, trimmedStart);
    start = prefixStart < 0 ? 0 : prefixStart + element.dataset.prefix.length;
    while (originalValue[start] === " ") start += 1;
  }
  if (element.classList.contains("scene")) {
    if (originalValue[start] === ".") start += 1;
    const sceneNumber = originalValue.slice(start, end).match(/\s+#[^#]+#\s*$/);
    if (sceneNumber) end = start + sceneNumber.index;
  }
  return { start, end, map: fountainInlineSourceMap(originalValue.slice(start, end)) };
}

function previewSourceOffset(element, originalValue, displayOffset, affinity = "caret") {
  const body = previewSourceBody(element, originalValue);
  const scenePrefix = element.dataset.sceneNumber && docSettings.sceneNumbers === "inline"
    ? `${element.dataset.sceneNumber}. `.length
    : 0;
  const offset = Math.max(0, Math.min(displayOffset - scenePrefix, body.map.startMap.length - 1));
  const map = affinity === "start" ? body.map.startMap : affinity === "end" ? body.map.endMap : body.map.caretMap;
  return body.start + (map[offset] ?? body.end - body.start);
}

function activeInlineMarkers(value, sourceOffset) {
  const markers = [];
  const markup = /(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;
  for (const match of value.matchAll(markup)) {
    const openingEnd = match.index + match[1].length;
    const closingStart = match.index + match[0].length - match[1].length;
    if (sourceOffset >= openingEnd && sourceOffset <= closingStart) markers.push(match[1]);
  }
  return markers;
}

function previewTextOffset(element, node, offset) {
  if (!element.contains(node) && element !== node) return element.textContent.length;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(node, offset);
  return range.toString().length;
}

function previewSelection(line = previewLineForNode(getSelection()?.focusNode)) {
  const selection = getSelection();
  if (!line || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
  const startLine = startElement?.closest?.(".script-line") || line;
  const endLine = endElement?.closest?.(".script-line") || line;
  return {
    startLine,
    endLine,
    startOffset: previewTextOffset(startLine, range.startContainer, range.startOffset),
    endOffset: previewTextOffset(endLine, range.endContainer, range.endOffset),
    direction: !range.collapsed && selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset ? "backward" : "forward",
  };
}

function previewLineIsEditable(line) {
  if (!line?.classList.contains("script-line")) return false;
  if (line.classList.contains("section")) return line.classList.contains("act");
  return !["synopsis", "note", "boneyard", "title-key", "page-break"].some((type) => line.classList.contains(type));
}

function adjacentPreviewEditableLine(line, direction) {
  const candidates = $$(".script-line[data-line]", page).filter(previewLineIsEditable);
  const current = candidates.indexOf(line);
  return current < 0 ? null : candidates[current + direction] || null;
}

function previewCaretIsOnVisualEdge(line, edge) {
  const selection = getSelection();
  if (!selection?.rangeCount || !line.contains(selection.focusNode)) return false;
  const edit = previewSelection(line);
  if (!edit || edit.startLine !== edit.endLine || edit.startOffset !== edit.endOffset) return false;
  if (!line.textContent.length) return true;
  const content = document.createRange();
  content.selectNodeContents(line);
  const contentRects = [...content.getClientRects()];
  const edgeTop = edge === "first" ? contentRects[0]?.top : contentRects.at(-1)?.top;
  const caret = selection.getRangeAt(0).cloneRange();
  caret.collapse(false);
  const caretRects = [...caret.getClientRects()];
  if (!caretRects.length) return edge === "first" ? edit.startOffset === 0 : edit.startOffset === line.textContent.length;
  return edgeTop !== undefined
    && caretRects.length > 0
    && caretRects.every((rect) => Math.abs(rect.top - edgeTop) < 1);
}

function sourceOffsetForLine(lines, index, column) {
  return lines.slice(0, index).reduce((total, value) => total + value.length + 1, 0) + column;
}

function setSourceCursorFromPreview(element, displayOffset = element.textContent.length) {
  const lines = source.value.replace(/\r\n?/g, "\n").split("\n");
  const index = Number(element.dataset.line);
  const column = previewSourceOffset(element, lines[index] || "", displayOffset);
  const offset = sourceOffsetForLine(lines, index, column);
  source.setSelectionRange(offset, offset);
  scrollSourceTarget(index);
  updateCursor();
}

function setSourceSelectionFromPreview(edit) {
  const lines = source.value.replace(/\r\n?/g, "\n").split("\n");
  const startIndex = Number(edit.startLine.dataset.line);
  const endIndex = Number(edit.endLine.dataset.line);
  const startColumn = previewSourceOffset(edit.startLine, lines[startIndex] || "", edit.startOffset, "start");
  const endColumn = previewSourceOffset(edit.endLine, lines[endIndex] || "", edit.endOffset, "end");
  const start = sourceOffsetForLine(lines, startIndex, startColumn);
  const end = sourceOffsetForLine(lines, endIndex, endColumn);
  source.setSelectionRange(start, end, edit.direction);
  scrollSourceTarget(edit.direction === "backward" ? startIndex : endIndex);
  updateCursor();
}

function syncPreviewLine(element) {
  const index = Number(element.dataset.line);
  const lines = source.value.replace(/\r\n?/g, "\n").split("\n");
  const oldDisplay = element.dataset.display ?? element.textContent;
  const newDisplay = element.textContent.replace(/\n/g, "");
  let start = 0;
  while (start < oldDisplay.length && start < newDisplay.length && oldDisplay[start] === newDisplay[start]) start += 1;
  let oldEnd = oldDisplay.length;
  let newEnd = newDisplay.length;
  while (oldEnd > start && newEnd > start && oldDisplay[oldEnd - 1] === newDisplay[newEnd - 1]) { oldEnd -= 1; newEnd -= 1; }
  const collapsed = start === oldEnd;
  const rawStart = previewSourceOffset(element, lines[index], start, collapsed ? "caret" : "start");
  const rawEnd = previewSourceOffset(element, lines[index], oldEnd, collapsed ? "caret" : "end");
  const value = lines[index].slice(0, rawStart) + newDisplay.slice(start, newEnd) + lines[index].slice(rawEnd);
  lines[index] = value;
  element.dataset.display = newDisplay;
  element.innerHTML = fountainInlineHtml(newDisplay) || "<br>";
  placeCaretAtOffset(element, newEnd);
  source.value = lines.join("\n");
  const offset = sourceOffsetForLine(lines, index, rawStart + newEnd - start);
  source.setSelectionRange(offset, offset);
  sourceChanged({ fromPreview: true });
}

function replacePreviewSelection(edit, text) {
  const lines = source.value.replace(/\r\n?/g, "\n").split("\n");
  const startIndex = Number(edit.startLine.dataset.line);
  const endIndex = Number(edit.endLine.dataset.line);
  const before = edit.startLine.textContent.slice(0, edit.startOffset);
  const after = edit.endLine.textContent.slice(edit.endOffset);
  let insertedText = text.replace(/\r\n?/g, "\n");
  const displayLines = `${before}${insertedText}${after}`.split("\n");
  const collapsed = startIndex === endIndex && edit.startOffset === edit.endOffset;
  const rawStart = previewSourceOffset(edit.startLine, lines[startIndex], edit.startOffset, collapsed ? "caret" : "start");
  const rawEnd = previewSourceOffset(edit.endLine, lines[endIndex], edit.endOffset, collapsed ? "caret" : "end");
  const trailingSource = lines[endIndex].slice(rawEnd);
  const preservedNotes = startIndex === endIndex
    ? []
    : lines.slice(startIndex + 1, endIndex).filter((value) => /^\s*\[\[.*\]\]\s*$/.test(value));
  if (startIndex === endIndex && insertedText.includes("\n")) {
    const markers = activeInlineMarkers(lines[startIndex], rawStart);
    if (markers.length) insertedText = insertedText.replaceAll("\n", `${[...markers].reverse().join("")}\n${markers.join("")}`);
  }
  const replacements = `${lines[startIndex].slice(0, rawStart)}${insertedText}${lines[endIndex].slice(rawEnd)}`.split("\n");
  if (startIndex === endIndex && edit.startLine.classList.contains("centered") && replacements.length > 1) {
    replacements[0] = `${replacements[0].trimEnd()} <`;
    replacements[replacements.length - 1] = `> ${replacements.at(-1).trimStart()}`;
    for (let index = 1; index < replacements.length - 1; index += 1) replacements[index] = `> ${replacements[index]} <`;
  }
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacements, ...preservedNotes);
  source.value = lines.join("\n");
  const focusLine = startIndex + displayLines.length - 1;
  const focusOffset = displayLines.length === 1 ? before.length + text.length : text.split(/\r\n?|\n/).at(-1).length;
  const sourceColumn = replacements.at(-1).length - trailingSource.length;
  const sourceOffset = sourceOffsetForLine(lines, focusLine, Math.max(0, sourceColumn));
  source.setSelectionRange(sourceOffset, sourceOffset);
  sourceChanged({ fromPreview: true });
  if (startIndex === endIndex && displayLines.length === 1) {
    edit.startLine.innerHTML = fountainInlineHtml(displayLines[0]) || "<br>";
    edit.startLine.dataset.display = displayLines[0];
    page.focus({ preventScroll: true });
    placeCaretAtOffset(edit.startLine, focusOffset);
    setSourceCursorFromPreview(edit.startLine, focusOffset);
    showPreviewCharacterCompletions(edit.startLine);
  } else {
    renderPreview({ focusLine, focusOffset, revealEmptyBefore: insertedText.includes("\n"), draftBefore: insertedText.includes("\n") && before.length === 0 });
  }
}

function previewDeleteSelection(edit, direction, byWord = false) {
  if (edit.startLine !== edit.endLine || edit.startOffset !== edit.endOffset) return replacePreviewSelection(edit, "");
  const line = edit.startLine;
  const index = Number(line.dataset.line);
  const value = line.textContent;
  if (direction === "backward" && edit.startOffset > 0) {
    const before = value.slice(0, edit.startOffset);
    edit.startOffset = byWord ? before.search(/\S+\s*$/) : edit.startOffset - 1;
  } else if (direction === "forward" && edit.endOffset < value.length) {
    const after = value.slice(edit.endOffset);
    const length = byWord ? (after.match(/^\s*\S+/)?.[0].length || 1) : 1;
    edit.endOffset += length;
  } else {
    const candidates = $$(".script-line[data-display]", page).filter(previewLineIsEditable);
    const current = candidates.indexOf(line);
    const adjacent = candidates[current + (direction === "backward" ? -1 : 1)];
    if (!adjacent) return;
    if (direction === "backward") {
      edit.startLine = adjacent;
      edit.startOffset = adjacent.textContent.length;
    } else {
      edit.endLine = adjacent;
      edit.endOffset = 0;
    }
  }
  replacePreviewSelection(edit, "");
}

function hidePreviewCompletions() {
  $("#preview-completion-menu").hidden = true;
  state.previewCompletionItems = [];
  state.previewCompletionLine = null;
}

function showPreviewCharacterCompletions(element) {
  const text = element.textContent.trim().toUpperCase();
  const explicitCharacter = text.startsWith("@");
  const fragment = explicitCharacter ? text.slice(1) : text;
  if ((!explicitCharacter && !/^[A-Z][A-Z0-9 ._'-]*$/.test(fragment)) || (explicitCharacter && !/^[A-Z0-9 ._'-]*$/.test(fragment))) return hidePreviewCompletions();
  state.previewCompletionItems = state.metadata.characters.map((character) => character.name)
    .filter((name, itemIndex, names) => name.startsWith(fragment) && name !== fragment && names.indexOf(name) === itemIndex);
  state.previewCompletionIndex = 0;
  state.previewCompletionLine = element;
  renderPreviewCharacterCompletions();
}

function renderPreviewCharacterCompletions() {
  const menu = $("#preview-completion-menu");
  if (!state.previewCompletionItems.length) return hidePreviewCompletions();
  menu.hidden = false;
  menu.innerHTML = state.previewCompletionItems.map((name, index) => `<button class="completion-item ${index === state.previewCompletionIndex ? "selected" : ""}" type="button" role="option" aria-selected="${index === state.previewCompletionIndex}" data-index="${index}"><span class="completion-icon">@</span><span>${escapeHtml(name)}</span><small>Character</small></button>`).join("");
  positionPreviewCompletion();
}

function positionPreviewCompletion() {
  const menu = $("#preview-completion-menu");
  const line = state.previewCompletionLine;
  if (!line) return;
  const panelRect = $(".preview-panel").getBoundingClientRect();
  const selection = getSelection();
  let anchor = line.getBoundingClientRect();
  if (selection?.rangeCount && line.contains(selection.focusNode)) {
    const caret = document.createRange();
    caret.setStart(selection.focusNode, selection.focusOffset); caret.collapse(true);
    anchor = caret.getClientRects()[0] || caret.getBoundingClientRect();
    if (!anchor.width && !anchor.height) {
      const used = document.createRange();
      used.selectNodeContents(line); used.setEnd(selection.focusNode, selection.focusOffset);
      const usedRect = used.getBoundingClientRect();
      const lineRect = line.getBoundingClientRect();
      anchor = { left: usedRect.right, right: usedRect.right, top: lineRect.top, bottom: lineRect.bottom, width: 0, height: lineRect.height };
    }
  }
  const width = Math.min(310, panelRect.width - 16);
  const left = Math.max(panelRect.left + 8, Math.min(panelRect.right - width - 8, anchor.left));
  const menuHeight = Math.min(menu.scrollHeight, 245);
  const below = anchor.bottom + 6;
  const top = below + menuHeight <= panelRect.bottom - 8 ? below : Math.max(panelRect.top + 8, anchor.top - menuHeight - 6);
  menu.style.left = `${left}px`; menu.style.top = `${top}px`; menu.style.right = "auto"; menu.style.bottom = "auto";
}

function acceptPreviewCharacterCompletion(index = state.previewCompletionIndex) {
  const name = state.previewCompletionItems[index];
  const line = state.previewCompletionLine;
  if (!name || !line) return;
  line.textContent = name;
  syncPreviewLine(line);
  hidePreviewCompletions();
  page.focus({ preventScroll: true }); placeCaretAtOffset(line, line.textContent.length);
}

function renderEditorChrome() {
  renderSourceSyntax();
  syncSourceOverlay();
  renderLineNumbers();
  updateCursor();
}

function renderLineNumbers() {
  const gutter = $("#line-numbers");
  const highlight = $("#source-highlight");
  const numbers = source.value.split("\n").map((line, index) => {
    const sourceLine = $(`[data-source-line="${index}"]`, highlight);
    const top = sourceLine?.offsetTop || 0;
    return `<span class="line-number" style="top:${Math.max(0, top)}px">${index + 1}</span>`;
  }).join("");
  const scrollHeight = Math.max(source.scrollHeight, highlight.scrollHeight);
  gutter.innerHTML = `${numbers}<span class="line-number-spacer" style="height:${scrollHeight}px"></span>`;
  gutter.scrollTop = source.scrollTop;
}

function fountainSyntaxHtml(value) {
  return escapeHtml(value).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g, '<span class="fountain-markup">$1</span>');
}

function renderSourceSyntax() {
  const classes = { scene: "scene", character: "character", dialogue: "dialogue", parenthetical: "parenthetical", transition: "transition", section: "section", synopsis: "synopsis", note: "note", boneyard: "boneyard", lyric: "lyric", "title-value": "title", "title-value title": "title" };
  const lines = classifyLines(source.value);
  $("#source-highlight").innerHTML = lines.map((line) => {
    const name = classes[line.type];
    const value = fountainSyntaxHtml(line.raw) || " ";
    return `<span data-source-line="${line.index}"${name ? ` class="syntax-${name}"` : ""}>${value}</span>`;
  }).join("");
}

function boundedScrollLeft(element, value = element.scrollLeft) {
  const max = Math.max(0, element.scrollWidth - element.clientWidth);
  return Math.min(max, Math.max(0, value));
}

function syncSourceOverlay() {
  const highlight = $("#source-highlight");
  highlight.style.width = source.clientWidth ? `${source.clientWidth}px` : "";
  const scrollLeft = boundedScrollLeft(source);
  if (scrollLeft !== source.scrollLeft) source.scrollLeft = scrollLeft;
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = boundedScrollLeft(highlight, scrollLeft);
}

function currentPosition() {
  const activeOffset = source.selectionStart !== source.selectionEnd && source.selectionDirection !== "backward"
    ? source.selectionEnd
    : source.selectionStart;
  const before = source.value.slice(0, activeOffset);
  const parts = before.split("\n");
  return { line: parts.length - 1, column: parts.at(-1).length, start: before.lastIndexOf("\n") + 1 };
}

function scrollPreviewTarget(target, block = "nearest") {
  const previewScroll = $("#preview-scroll");
  const beatGuide = $("#beat-guide-layer");
  const targetRect = target.getBoundingClientRect();
  const scrollRect = previewScroll.getBoundingClientRect();
  const coveredTop = scrollRect.top + (beatGuide.hidden ? 0 : beatGuide.getBoundingClientRect().height);
  const visibleHeight = scrollRect.bottom - coveredTop;
  let top = previewScroll.scrollTop;
  let left = previewScroll.scrollLeft;
  if (block === "center") top += targetRect.top - coveredTop - (visibleHeight - targetRect.height) / 2;
  else if (targetRect.top < coveredTop) top += targetRect.top - coveredTop;
  else if (targetRect.bottom > scrollRect.bottom) top += targetRect.bottom - scrollRect.bottom;
  if (targetRect.left < scrollRect.left) left += targetRect.left - scrollRect.left;
  else if (targetRect.right > scrollRect.right) left += targetRect.right - scrollRect.right;
  previewScroll.scrollTop = Math.max(0, top);
  previewScroll.scrollLeft = boundedScrollLeft(previewScroll, left);
}

function scrollSourceTarget(index, block = "nearest") {
  if (!source.clientHeight) return;
  const highlight = $("#source-highlight");
  const target = $(`[data-source-line="${index}"]`, highlight);
  if (!target) return;
  const computed = getComputedStyle(source);
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;
  const lineHeight = parseFloat(computed.lineHeight) || 20.15;
  const top = target.offsetTop;
  const bottom = top + lineHeight;
  let next = source.scrollTop;
  if (block === "center") next = top - (source.clientHeight - lineHeight) / 2;
  else if (top < source.scrollTop + paddingTop) next = top - paddingTop;
  else if (bottom > source.scrollTop + source.clientHeight - paddingBottom) next = bottom - source.clientHeight + paddingBottom;
  source.scrollTop = Math.max(0, next);
  syncSourceOverlay();
  $("#line-numbers").scrollTop = source.scrollTop;
}

function updatePreviewCursor(scroll = false, scrollBlock = "nearest", revealEmptyBefore = false) {
  const target = $(`[data-line="${currentPosition().line}"]`, page);
  $$(".script-line.source-current", page).forEach((line) => line.classList.remove("source-current"));
  target?.classList.add("source-current");
  revealPreviewEmptyRun(target, revealEmptyBefore);
  if (scroll && state.previewMode === "live" && target) scrollPreviewTarget(target, scrollBlock);
}

function updateCursor({ scrollPreview = false, scrollBlock = "nearest" } = {}) {
  const position = currentPosition();
  $("#cursor-position").textContent = `Ln ${position.line + 1}, Col ${position.column + 1}`;
  const type = classifyLines(source.value)[position.line]?.type || "action";
  const labels = { scene: "Scene heading", character: "Character", dialogue: "Dialogue", parenthetical: "Parenthetical", transition: "Transition", "title-value": "Title page", "title-value title": "Title" };
  $("#editor-status").textContent = labels[type] || type[0].toUpperCase() + type.slice(1);
  const computed = getComputedStyle(source);
  const lineHeight = parseFloat(computed.lineHeight) || 20.15;
  const sourceLine = $(`[data-source-line="${position.line}"]`, $("#source-highlight"));
  const lineTop = sourceLine
    ? sourceLine.offsetTop - source.scrollTop - parseFloat(computed.paddingTop)
    : -source.scrollTop;
  $("#current-line").style.height = `${lineHeight}px`;
  $("#current-line").style.transform = `translateY(${lineTop}px)`;
  updatePreviewCursor(scrollPreview, scrollBlock);
}

function renderInsights(metadata) {
  state.metadata = metadata;
  renderPageMetric(metadata);
  $("#stat-scenes").textContent = metadata.scenes.length;
  $("#stat-words").textContent = metadata.wordCount.toLocaleString();
  $("#scene-count").textContent = metadata.scenes.length;
  $("#character-count").textContent = metadata.characters.length;
  $("#scene-list").innerHTML = renderOutline(metadata);
  renderCharacterTable();
  renderGeneralNotes();
  renderBeatGuide();
  const contentWords = metadata.dialogueWords + metadata.actionWords;
  const dialoguePercent = contentWords ? Math.round(metadata.dialogueWords / contentWords * 100) : 0;
  $("#dialogue-bar").style.width = `${dialoguePercent}%`;
  $("#dialogue-percent").textContent = `${dialoguePercent}%`;
  $("#action-percent").textContent = `${100 - dialoguePercent}%`;
  if ($("#character-analytics-dialog").open) renderCharacterAnalytics();
}

function renderPageMetric(metadata) {
  const target = $("#stat-pages");
  if (metadata.pageCount == null) { target.textContent = "—"; return; }
  const fractions = { 1: [1, 8], 2: [1, 4], 3: [3, 8], 4: [1, 2], 5: [5, 8], 6: [3, 4], 7: [7, 8] };
  const fraction = fractions[metadata.lastPageEighths];
  target.innerHTML = `${metadata.pageCount}${fraction ? ` <small class="page-fraction"><sup>${fraction[0]}</sup><sub>${fraction[1]}</sub></small>` : ""}`;
}

function renderCharacterTable() {
  const characters = state.metadata.characters || [];
  const notes = state.metadata.characterNotes || {};
  $("#character-line-table").innerHTML = characters.length
    ? `<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${characters.map((character) => {
      const hasNote = Boolean(notes[character.name]?.text);
      return `<tr><td><button type="button" data-character-note="${escapeHtml(character.name)}">${escapeHtml(character.name)}${hasNote ? `<span class="note-indicator" aria-label="Has notes">●</span>` : ""}</button></td><td>${character.lines}</td></tr>`;
    }).join("")}</tbody></table>`
    : `<div class="empty-list">Characters appear as dialogue is written.</div>`;
}

function renderGeneralNotes() {
  const notes = state.metadata.generalNotes || [];
  $("#general-note-count").textContent = notes.length;
  $("#general-notes").innerHTML = notes.length
    ? notes.map((note) => `<button type="button" data-general-note-line="${note.line}"><span>${escapeHtml(note.text)}</span><small>Edit</small></button>`).join("")
    : `<div class="empty-list">No general notes yet.</div>`;
}

function renderBeatGuide() {
  const layer = $("#beat-guide-layer");
  const button = $("#menu-toggle-beat-guide");
  const beats = state.metadata.beatSheet?.beats || [];
  const enabled = state.beatGuide && state.previewMode === "live";
  state.activeBeat = Math.max(0, Math.min(state.activeBeat, Math.max(0, beats.length - 1)));
  layer.hidden = !enabled;
  layer.classList.toggle("empty", !beats.length);
  $(".preview-panel").classList.toggle("beat-runner-on", enabled);
  $(".menu-check", button).textContent = state.beatGuide ? "✓" : "";
  $$(".script-line.beat-area", page).forEach((line) => line.classList.remove("beat-area", "active-beat-area"));
  if (!enabled) { layer.innerHTML = ""; return; }
  beats.forEach((beat, index) => {
    if (!beat.range) return;
    for (let line = beat.range.startLine; line <= beat.range.endLine; line += 1) {
      const target = $(`[data-line="${line}"]`, page);
      target?.classList.add("beat-area");
      if (index === state.activeBeat) target?.classList.add("active-beat-area");
    }
  });
  const beat = beats[state.activeBeat];
  layer.innerHTML = beat
    ? `<div class="beat-runner-progress"><small>${state.activeBeat + 1}/${beats.length}</small><strong>Next Beat:</strong><span>${escapeHtml(beat.text)}</span>${beat.range ? `<em>Lines ${beat.range.startLine + 1}–${beat.range.endLine + 1}</em>` : ""}</div><div class="beat-runner-actions"><button type="button" data-previous-beat aria-label="Previous beat"${state.activeBeat ? "" : " disabled"}>←</button><button type="button" data-open-beat-sheet>Edit</button><button class="assign-beat-area" type="button" data-assign-beat-area>Assign + Next</button><button type="button" data-next-beat aria-label="Next beat"${state.activeBeat < beats.length - 1 ? "" : " disabled"}>→</button><button type="button" data-close-beat-guide aria-label="Hide Beat guide">×</button></div>`
    : `<div class="beat-runner-progress"><strong>Beat Sheet</strong><span>Add beats to start the writing runner.</span></div><div class="beat-runner-actions"><button class="empty-beat-sheet-button" type="button" data-open-beat-sheet>Open Beat Sheet</button><button type="button" data-close-beat-guide aria-label="Hide Beat guide">×</button></div>`;
}

function screenplayPageCount(physicalPages) {
  return Math.max(0, physicalPages - (state.metadata.titleFields?.length ? 1 : 0));
}

function selectedBeatArea() {
  const startOffset = source.selectionStart;
  const endOffset = source.selectionEnd;
  const lineAt = (offset) => source.value.slice(0, offset).split("\n").length - 1;
  const startLine = lineAt(startOffset);
  const endLine = lineAt(Math.max(startOffset, endOffset - (endOffset > startOffset ? 1 : 0)));
  return { startLine, endLine: Math.max(startLine, endLine) };
}

function assignCurrentBeatArea() {
  const sheet = state.metadata.beatSheet;
  if (!sheet?.beats?.[state.activeBeat] || sheet.line === null || sheet.line === undefined) return;
  const beats = sheet.beats.map((beat, index) => index === state.activeBeat ? { ...beat, range: selectedBeatArea() } : beat);
  const lines = sourceLines();
  lines[sheet.line] = managedBeatSheetSource(sheet.premise || "", beats);
  state.activeBeat = Math.min(beats.length - 1, state.activeBeat + 1);
  setSourceLines(lines);
  toast("Beat area assigned");
}

function jumpToBeatArea(beat) {
  if (!beat?.range) return;
  const lines = classifyLines(source.value);
  let target = beat.range.startLine;
  for (let line = beat.range.startLine; line <= beat.range.endLine; line += 1) {
    if (lines[line] && !["empty", "note", "boneyard"].includes(lines[line].type)) { target = line; break; }
  }
  jumpToLine(target + 1, false);
}

function outlineSceneRow(scene, label = scene.number) {
  return `<li><span class="scene-num">${escapeHtml(label)}</span><button type="button" data-line="${scene.line}">${escapeHtml(scene.heading)}</button></li>`;
}

function renderOutline(metadata) {
  const scenes = metadata.scenes || [];
  const acts = (metadata.sections || []).filter((section) => section.level === 1);
  if (!acts.length) return scenes.length ? scenes.map((scene) => outlineSceneRow(scene)).join("") : `<li class="empty-list">No scene headings yet.</li>`;
  const beforeActs = scenes.filter((scene) => !scene.actNumber).map((scene) => outlineSceneRow(scene)).join("");
  const grouped = acts.map((act, index) => {
    const actNumber = index + 1;
    const actScenes = scenes
      .filter((scene) => scene.actNumber === actNumber)
      .map((scene, sceneIndex) => outlineSceneRow(scene, String(sceneIndex + 1)))
      .join("");
    return `<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${act.line}"><span>${index + 1}</span>${escapeHtml(act.title)}</button><ol>${actScenes || `<li class="empty-list">No scenes in this act.</li>`}</ol></li>`;
  }).join("");
  return beforeActs + grouped;
}

function canvasColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const CHARACTER_CHART_FALLBACKS = ["#0072b2", "#c65d00", "#00845f", "#b43c20", "#6653b8", "#a43f83", "#397b32", "#716400"];

function characterChartColor(name) {
  const knownIndex = (state.metadata.characters || []).findIndex((character) => character.name === name);
  let hash = 0;
  if (knownIndex < 0) for (const character of name) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  const index = (knownIndex < 0 ? hash : knownIndex) % CHARACTER_CHART_FALLBACKS.length;
  return canvasColor(`--character-chart-${index + 1}`, CHARACTER_CHART_FALLBACKS[index]);
}

function chartLabelColor(color) {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  const rgb = hex ? [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) : (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  if (rgb.length < 3) return "#fff";
  const luminance = rgb.reduce((sum, value, index) => sum + (value / 255) * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.58 ? "#17191b" : "#fff";
}

function fitCanvasText(context, value, width) {
  const text = String(value);
  if (context.measureText(text).width <= width) return text;
  let clipped = text;
  while (clipped.length && context.measureText(`${clipped}…`).width > width) clipped = clipped.slice(0, -1);
  return clipped ? `${clipped}…` : "";
}

function sceneCharacterWordSegments(sceneIndex) {
  const scenes = state.metadata.scenes || [];
  const typed = classifyLines(source.value);
  const start = Math.max(0, (scenes[sceneIndex]?.line || 1) - 1);
  const end = sceneIndex + 1 < scenes.length ? Math.max(start, scenes[sceneIndex + 1].line - 1) : typed.length;
  const segments = [];
  let active = "";
  let position = 0;
  const ignored = new Set(["empty", "parenthetical", "section", "synopsis", "note", "boneyard", "title-value", "title-value title", "character", "scene", "page-break"]);
  for (let index = start + 1; index < end; index += 1) {
    const line = typed[index];
    if (line.type === "character") { active = cleanCharacter(line.display); continue; }
    const words = ignored.has(line.type) ? 0 : (line.display.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    if (line.type === "dialogue" && active && words) segments.push({ character: active, start: position, words });
    position += words;
    if (!["dialogue", "parenthetical", "empty", "note"].includes(line.type)) active = "";
  }
  return { segments, total: position };
}

function renderSceneCharacterAnalytics(sceneIndex) {
  const canvas = $("#character-analytics-chart");
  const chartViewport = $(".analytics-chart-scroll", $("#character-analytics-dialog"));
  const scene = state.metadata.scenes[sceneIndex];
  const { segments, total } = sceneCharacterWordSegments(sceneIndex);
  const presentCharacters = new Set(segments.map((segment) => segment.character));
  const rollupOrder = (state.metadata.characters || []).map((character) => character.name);
  const characters = [
    ...rollupOrder.filter((character) => presentCharacters.has(character)),
    ...[...presentCharacters].filter((character) => !rollupOrder.includes(character)),
  ];
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const labelWidth = 150;
  const plotWidth = Math.max(760, chartViewport.clientWidth - labelWidth);
  const headerHeight = 58; const rowHeight = 38;
  const width = labelWidth + plotWidth; const height = headerHeight + Math.max(characters.length, 1) * rowHeight;
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; canvas.style.cursor = "default";
  const context = canvas.getContext("2d"); context.scale(scale, scale);
  const surface = canvasColor("--surface", "#fff"); const surface2 = canvasColor("--surface-2", "#f2f2f2");
  const ink = canvasColor("--ink", "#202124"); const muted = canvasColor("--muted", "#6b7280");
  const border = canvasColor("--border", "#d7d9dd");
  context.fillStyle = surface; context.fillRect(0, 0, width, height);
  context.fillStyle = surface2; context.fillRect(0, 0, width, headerHeight);
  context.strokeStyle = border; context.lineWidth = 1; context.strokeRect(.5, .5, width - 1, headerHeight);
  context.textBaseline = "middle"; context.textAlign = "left"; context.fillStyle = ink;
  context.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillText(fitCanvasText(context, scene?.heading || `Scene ${sceneIndex + 1}`, labelWidth - 20), 12, 20);
  context.fillStyle = muted; context.font = "9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillText(`${total.toLocaleString()} scene words`, 12, 40);
  [0, .25, .5, .75, 1].forEach((ratio) => {
    const x = labelWidth + plotWidth * ratio;
    context.strokeStyle = border; context.beginPath(); context.moveTo(x + .5, headerHeight); context.lineTo(x + .5, height); context.stroke();
    context.fillStyle = muted; context.textAlign = ratio === 0 ? "left" : ratio === 1 ? "right" : "center";
    context.fillText(Math.round(total * ratio).toLocaleString(), x, 42);
  });
  characters.forEach((character, row) => {
    const y = headerHeight + row * rowHeight;
    if (row % 2 === 1) { context.fillStyle = surface2; context.fillRect(0, y, width, rowHeight); }
    context.fillStyle = ink; context.textAlign = "left"; context.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(fitCanvasText(context, character, labelWidth - 20), 12, y + rowHeight / 2);
    const characterColor = characterChartColor(character);
    segments.filter((segment) => segment.character === character).forEach((segment) => {
      const x = labelWidth + (total ? segment.start / total : 0) * plotWidth;
      const segmentWidth = Math.max(2, (total ? segment.words / total : 0) * plotWidth);
      context.fillStyle = characterColor; context.fillRect(x, y + 8, segmentWidth, rowHeight - 16);
    });
  });
  if (!characters.length) { context.fillStyle = muted; context.textAlign = "center"; context.fillText("No character dialogue in this scene.", width / 2, headerHeight + rowHeight / 2); }
  $("#character-analytics-title").textContent = `Scene ${sceneIndex + 1} Character Gantt`;
  $("#character-analytics-description").textContent = `${scene?.heading || "Scene"} · Solid bars show dialogue word count and position within the scene.`;
  $("#character-analytics-back").hidden = state.metadata.scenes.length <= 1;
  $("#character-analytics-legend").hidden = true;
  canvas.setAttribute("aria-label", `Character dialogue word-position Gantt for scene ${sceneIndex + 1}, ${scene?.heading || "scene"}, with ${total} words`);
}

function renderCharacterAnalytics() {
  if (state.characterAnalyticsScene !== null && state.metadata.scenes[state.characterAnalyticsScene]) { renderSceneCharacterAnalytics(state.characterAnalyticsScene); return; }
  const canvas = $("#character-analytics-chart");
  const characters = state.metadata.characters;
  const scenes = state.metadata.scenes;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const labelWidth = 150;
  const sceneWidth = 92;
  const actHeight = 28;
  const sceneHeight = 54;
  const rowHeight = 34;
  const width = scenes.length ? labelWidth + scenes.length * sceneWidth : 480;
  const height = actHeight + sceneHeight + Math.max(characters.length, 1) * rowHeight;
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  canvas.style.cursor = scenes.length ? "pointer" : "default";
  $("#character-analytics-title").textContent = "Character Analytics";
  $("#character-analytics-description").textContent = "Dialogue lines by character across acts and scenes. Select a scene header for word-position detail.";
  $("#character-analytics-back").hidden = true;

  const surface = canvasColor("--surface", "#fff");
  const surface2 = canvasColor("--surface-2", "#f2f2f2");
  const ink = canvasColor("--ink", "#202124");
  const muted = canvasColor("--muted", "#6b7280");
  const border = canvasColor("--border", "#d7d9dd");
  const lineCounts = characters.flatMap((character) => (character.sceneLines || []).map((item) => item.lines)).filter((lines) => lines > 0);
  const minLines = lineCounts.length ? Math.min(...lineCounts) : 0;
  const maxLines = lineCounts.length ? Math.max(...lineCounts) : 0;
  const legend = $("#character-analytics-legend");
  legend.hidden = true;
  $("#character-analytics-min").textContent = `${minLines} ${minLines === 1 ? "line" : "lines"}`;
  $("#character-analytics-max").textContent = `${maxLines} ${maxLines === 1 ? "line" : "lines"}`;
  context.fillStyle = surface;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = border;
  context.lineWidth = 1;
  context.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.textBaseline = "middle";

  let groupStart = 0;
  while (groupStart < scenes.length) {
    const act = scenes[groupStart].act || "Screenplay";
    let groupEnd = groupStart + 1;
    while (groupEnd < scenes.length && (scenes[groupEnd].act || "Screenplay") === act) groupEnd += 1;
    const x = labelWidth + groupStart * sceneWidth;
    const groupWidth = (groupEnd - groupStart) * sceneWidth;
    context.fillStyle = surface2;
    context.fillRect(x, 0, groupWidth, actHeight);
    context.fillStyle = ink;
    context.textAlign = "center";
    context.fillText(fitCanvasText(context, act, groupWidth - 12), x + groupWidth / 2, actHeight / 2);
    context.strokeRect(x + 0.5, 0.5, groupWidth, actHeight);
    groupStart = groupEnd;
  }

  context.fillStyle = surface2;
  context.fillRect(0, 0, labelWidth, actHeight + sceneHeight);
  context.fillStyle = muted;
  context.textAlign = "left";
  context.fillText("CHARACTER", 12, actHeight + sceneHeight / 2);
  const actSceneCounts = new Map();
  const sceneLabels = scenes.map((scene, index) => {
    if (!scene.actNumber) return String(index + 1);
    const sceneInAct = (actSceneCounts.get(scene.actNumber) || 0) + 1;
    actSceneCounts.set(scene.actNumber, sceneInAct);
    return String(sceneInAct);
  });
  scenes.forEach((scene, index) => {
    const x = labelWidth + index * sceneWidth;
    context.strokeStyle = border;
    context.strokeRect(x + 0.5, actHeight + 0.5, sceneWidth, sceneHeight);
    context.fillStyle = ink;
    context.textAlign = "center";
    context.fillText(fitCanvasText(context, sceneLabels[index], sceneWidth - 10), x + sceneWidth / 2, actHeight + 16);
    context.fillStyle = muted;
    context.font = "9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(fitCanvasText(context, scene.heading, sceneWidth - 10), x + sceneWidth / 2, actHeight + 36);
    context.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  });

  characters.forEach((character, row) => {
    const y = actHeight + sceneHeight + row * rowHeight;
    if (row % 2 === 1) {
      context.fillStyle = surface2;
      context.fillRect(0, y, labelWidth + scenes.length * sceneWidth, rowHeight);
    }
    context.fillStyle = ink;
    context.textAlign = "left";
    context.fillText(fitCanvasText(context, character.name, labelWidth - 20), 12, y + rowHeight / 2);
    const usage = new Map((character.sceneLines || []).map((item) => [item.scene, item.lines]));
    const characterColor = characterChartColor(character.name);
    scenes.forEach((scene, index) => {
      const lineCount = usage.get(index + 1) || 0;
      if (!lineCount) return;
      const x = labelWidth + index * sceneWidth + 4;
      const intensity = maxLines === minLines ? 1 : 0.3 + 0.7 * ((lineCount - minLines) / (maxLines - minLines));
      context.save();
      context.globalAlpha = intensity;
      context.fillStyle = characterColor;
      context.fillRect(x, y + 7, sceneWidth - 8, rowHeight - 14);
      context.restore();
      context.fillStyle = intensity >= 0.62 ? chartLabelColor(characterColor) : ink;
      context.textAlign = "center";
      context.fillText(String(lineCount), x + (sceneWidth - 8) / 2, y + rowHeight / 2);
    });
  });
  if (!scenes.length) {
    context.fillStyle = muted;
    context.textAlign = "center";
    context.fillText("Add scene headings to build the timeline.", width / 2, actHeight + sceneHeight + rowHeight / 2);
  }
  canvas.setAttribute("aria-label", `Character dialogue timeline with ${characters.length} characters across ${scenes.length} scenes; usage ranges from ${minLines} to ${maxLines} dialogue lines`);
}

function characterLineUsageCsv() {
  return state.metadata.characters.map((character) => `${character.name}, ${character.lines}`).join("\r\n");
}

function openCharacterAnalytics() {
  state.characterAnalyticsScene = state.metadata.scenes.length === 1 ? 0 : null;
  $("#character-analytics-dialog").showModal();
  renderCharacterAnalytics();
}

async function copyCharacterLineUsage() {
  try { await navigator.clipboard.writeText(characterLineUsageCsv()); toast("Line usage CSV copied"); }
  catch { toast("Clipboard access was denied"); }
}

async function saveCharacterAnalyticsPng() {
  renderCharacterAnalytics();
  const blob = await new Promise((resolve) => $("#character-analytics-chart").toBlob(resolve, "image/png"));
  if (!blob) { toast("Could not create analytics image"); return; }
  await download(blob, normalizedFilename("character-analytics.png"));
  toast("Character analytics PNG saved");
}

function recordHistory() {
  if (state.history[state.historyIndex] === source.value) return;
  state.history.splice(state.historyIndex + 1);
  state.history.push(source.value);
  state.historyIndex = state.history.length - 1;
  if (state.history.length > 250) { state.history.shift(); state.historyIndex -= 1; }
}

function restoreHistory(index) {
  if (index < 0 || index >= state.history.length || index === state.historyIndex) return;
  const previewLine = page.contains(document.activeElement) ? Number(document.activeElement.dataset.line) : null;
  const sourcePosition = source.selectionStart;
  state.historyIndex = index; source.value = state.history[index]; sourceChanged({ fromPreview: previewLine !== null, record: false, rebaseBeats: false });
  if (previewLine !== null) renderPreview({ focusLine: Math.min(previewLine, source.value.split("\n").length - 1) });
  else { source.focus(); source.setSelectionRange(Math.min(sourcePosition, source.value.length), Math.min(sourcePosition, source.value.length)); }
}

function undoDocument() { restoreHistory(state.historyIndex - 1); }
function redoDocument() { restoreHistory(state.historyIndex + 1); }

function transformBeatRange(range, editStart, oldCount, newCount) {
  if (!range) return null;
  const start = range.startLine;
  const endExclusive = range.endLine + 1;
  const editEnd = editStart + oldCount;
  const delta = newCount - oldCount;
  if (editEnd <= start) return { startLine: start + delta, endLine: range.endLine + delta };
  if (editStart >= endExclusive) return range;
  if (!newCount && editStart <= start && editEnd >= endExclusive) return null;
  const nextStart = start < editStart ? start : editStart;
  const survivingTail = endExclusive > editEnd ? endExclusive + delta : nextStart;
  const replacementEnd = editStart + newCount;
  const nextEndExclusive = Math.max(nextStart + 1, survivingTail, replacementEnd);
  return { startLine: nextStart, endLine: nextEndExclusive - 1 };
}

function rebaseBeatRanges(previousValue, nextValue) {
  if (!previousValue || previousValue === nextValue) return nextValue;
  const previousLines = previousValue.replace(/\r\n?/g, "\n").split("\n");
  const nextLines = nextValue.replace(/\r\n?/g, "\n").split("\n");
  const previousSheet = parseManagedNotes(previousLines).beatSheet;
  const nextSheet = parseManagedNotes(nextLines).beatSheet;
  if (previousSheet.line === null || nextSheet.line === null || !previousSheet.beats.some((beat) => beat.range)) return nextValue;

  let prefix = 0;
  while (prefix < previousLines.length && prefix < nextLines.length && previousLines[prefix] === nextLines[prefix]) prefix += 1;
  let previousSuffix = previousLines.length;
  let nextSuffix = nextLines.length;
  while (previousSuffix > prefix && nextSuffix > prefix && previousLines[previousSuffix - 1] === nextLines[nextSuffix - 1]) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }
  const oldCount = previousSuffix - prefix;
  const newCount = nextSuffix - prefix;
  if (previousSheet.line >= prefix && previousSheet.line < previousSuffix
      && nextSheet.line >= prefix && nextSheet.line < nextSuffix) return nextValue;

  const beats = nextSheet.beats.map((beat) => ({
    ...beat,
    range: transformBeatRange(beat.range, prefix, oldCount, newCount),
  }));
  nextLines[nextSheet.line] = managedBeatSheetSource(nextSheet.premise, beats);
  return nextLines.join("\n");
}

function sourceChanged({ fromPreview = false, record = true, rebaseBeats = true } = {}) {
  if (rebaseBeats) {
    const selectionStart = source.selectionStart;
    const selectionEnd = source.selectionEnd;
    const selectionDirection = source.selectionDirection;
    const rebased = rebaseBeatRanges(state.lastSourceValue, source.value);
    if (rebased !== source.value) {
      source.value = rebased;
      source.setSelectionRange(Math.min(selectionStart, rebased.length), Math.min(selectionEnd, rebased.length), selectionDirection);
    }
  }
  state.lastSourceValue = source.value;
  if (record) recordHistory();
  document.body.classList.toggle("dirty", source.value !== state.savedSource);
  if (!fromPreview || state.previewMode === "source") renderEditorChrome();
  if (!fromPreview) renderPreview();
  clearTimeout(state.insightTimer);
  if (fromPreview) state.insightTimer = setTimeout(() => renderInsights(analyzeLocally(source.value)), 80);
  else renderInsights(analyzeLocally(source.value));
  scheduleCompile();
  scheduleWorkspaceCache();
}

function scheduleCompile(delay = 350) {
  clearTimeout(state.compileTimer);
  state.compileController?.abort();
  const revision = ++state.compileRevision;
  $("#compile-status").textContent = "Editing…";
  $("#compile-status").classList.remove("error");
  state.compileTimer = setTimeout(() => STATIC_HOST ? compileStaticPageCount(revision) : compile(revision), STATIC_HOST ? Math.max(delay, 700) : delay);
}

function showCompileError(error, browserCompiler = STATIC_HOST) {
  const detail = error instanceof Error ? error.message : String(error || "Unknown compiler error");
  const message = browserCompiler
    ? `Browser PDF compiler failed: ${detail}. Reload the page and try again.`
    : detail.toLowerCase().includes("fetch")
      ? `Desktop compiler unavailable: ${detail}. Restart Fountain Publisher and reload the page.`
      : `Compilation failed: ${detail}`;
  $("#compile-status").textContent = message;
  $("#compile-status").title = message;
  $("#compile-status").classList.add("error");
}

async function compileStaticPageCount(revision) {
  $("#compile-status").textContent = "Compiling…";
  try {
    const blob = await compileWithBrowserScreenplain("pdf", $("#page-size").value);
    const pageCount = screenplayPageCount(await countPdfBlobPages(blob));
    if (revision !== state.compileRevision) return;
    state.metadata.pageCount = pageCount;
    state.metadata.lastPageEighths = state.browserLastPageEighths;
    state.metadata.estimatedSeconds = pageCount * 60;
    renderPageMetric(state.metadata);
    $("#compile-status").textContent = "Compiled";
  } catch (error) {
    if (revision !== state.compileRevision) return;
    showCompileError(error, true);
  }
}

async function compile(revision) {
  const controller = new AbortController();
  state.compileController = controller;
  $("#compile-status").textContent = "Compiling…";
  try {
    const response = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.value, pageSize: $("#page-size").value, sceneNumbers: docSettings.sceneNumbers, sceneNumberFormat: docSettings.sceneNumberFormat }), signal: controller.signal });
    if (shouldUseBrowserCompiler(response, "application/json")) {
      STATIC_HOST = true;
      await compileStaticPageCount(revision);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Compilation failed");
    if (result.pageCount == null) result.pageCount = screenplayPageCount(await countPdfBlobPages(await requestBinary("/api/render/pdf")));
    result.estimatedSeconds = result.pageCount * 60;
    if (revision !== state.compileRevision) return;
    renderInsights(result);
    $("#compile-status").textContent = "Compiled";
  } catch (error) {
    if (error.name === "AbortError") return;
    if (revision !== state.compileRevision) return;
    showCompileError(error, false);
  } finally {
    if (state.compileController === controller) state.compileController = null;
  }
}

async function countPdfBlobPages(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type\s*\/Page\b/g) || []).length;
}

function completionCandidates() {
  const { line, start } = currentPosition();
  const lines = source.value.split("\n");
  const text = lines[line].slice(0, source.selectionStart - start);
  const trimmed = text.trim();
  const explicitCharacter = trimmed.startsWith("@");
  const previousBlank = line === 0 || !lines[line - 1].trim();
  const items = [];
  const add = (value, detail, icon = "ƒ") => items.push({ value, detail, icon });
  const characterFragment = (explicitCharacter ? trimmed.slice(1) : trimmed.split(/\s+/).at(-1)).toUpperCase();
  if (explicitCharacter || (characterFragment && state.metadata.characters.some((character) => character.name.startsWith(characterFragment)))) {
    state.metadata.characters.forEach((character) => add(character.name, `${character.lines} dialogue lines`, "@"));
  }
  if (line < 12 && !source.value.slice(0, start).includes("\n\n") && (!trimmed || /^[A-Za-z ]*$/.test(trimmed))) {
    ["Title: ", "Credit: ", "Author: ", "Source: ", "Draft date: ", "Contact: ", "Copyright: ", "Notes: "].filter((key) => !state.metadata.titleFields.some((used) => `${used}:`.toLowerCase() === key.trim().toLowerCase())).forEach((key) => add(key, "Title page", "T"));
  }
  if (/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(trimmed)) {
    ["DAY", "NIGHT", "MORNING", "EVENING", "LATER", "CONTINUOUS", "SAME", "MOMENTS LATER", "DAWN", "DUSK"].forEach((value) => add(value, "Time of day", "◷"));
  } else if (isScene(trimmed) || /^(?:INT|EXT|EST|I\/E)/i.test(trimmed)) {
    state.metadata.locations.forEach((value) => add(value, "Existing location", "⌂"));
  } else if (previousBlank) {
    if (!explicitCharacter) {
      ["INT. ", "EXT. ", "INT./EXT. ", "I/E. "].forEach((value) => add(value, "Scene heading", "#"));
      ["FADE IN:", ">CUT TO:", ">FADE OUT."].forEach((value) => add(value, "Transition", "→"));
    }
  }
  const fragment = (explicitCharacter ? trimmed.slice(1) : trimmed).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();
  return items.filter((item, index) => items.findIndex((other) => other.value === item.value) === index
    && (item.icon !== "@" || item.value.toUpperCase() !== characterFragment)
    && (!fragment || item.value.toUpperCase().startsWith(fragment) || item.detail === "Existing location"));
}

function showCompletions({ allowBlank = false } = {}) {
  const { line, start } = currentPosition();
  const currentText = source.value.split("\n")[line].slice(0, source.selectionStart - start).trim();
  if (!allowBlank && !currentText) return hideCompletions();
  state.completionItems = completionCandidates(); state.completionIndex = 0;
  if (!state.completionItems.length) return hideCompletions();
  renderCompletionMenu();
}

function renderCompletionMenu() {
  const menu = $("#completion-menu");
  menu.hidden = false;
  menu.innerHTML = state.completionItems.map((item, index) => `<button class="completion-item ${index === state.completionIndex ? "selected" : ""}" type="button" role="option" aria-selected="${index === state.completionIndex}" data-index="${index}"><span class="completion-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.value)}</span><small>${escapeHtml(item.detail)}</small></button>`).join("");
  positionSourceCompletion();
  $(".completion-item.selected", menu)?.scrollIntoView({ block: "nearest" });
}

function hideCompletions() { $("#completion-menu").hidden = true; state.completionItems = []; }

function positionSourceCompletion() {
  const menu = $("#completion-menu");
  const sourceRect = source.getBoundingClientRect();
  const panelRect = $("#source-panel").getBoundingClientRect();
  const computed = getComputedStyle(source);
  const mirror = document.createElement("div");
  const wrapped = document.body.classList.contains("source-wrap");
  const sourceScrollLeft = boundedScrollLeft(source);
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: computed.boxSizing,
    left: `${sourceRect.left - (wrapped ? 0 : sourceScrollLeft)}px`,
    top: `${sourceRect.top - source.scrollTop}px`,
    width: `${wrapped ? sourceRect.width : Math.max(source.scrollWidth, sourceRect.width)}px`,
    padding: computed.padding,
    border: computed.border,
    font: computed.font,
    letterSpacing: computed.letterSpacing,
    lineHeight: computed.lineHeight,
    whiteSpace: wrapped ? "pre-wrap" : "pre",
    overflowWrap: wrapped ? "anywhere" : "normal",
    tabSize: computed.tabSize,
  });
  mirror.append(document.createTextNode(source.value.slice(0, source.selectionStart)));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const caret = marker.getBoundingClientRect();
  mirror.remove();
  const width = Math.min(310, panelRect.width - 16);
  const left = Math.max(panelRect.left + 8, Math.min(panelRect.right - width - 8, caret.left));
  const menuHeight = Math.min(menu.scrollHeight, 245);
  const below = caret.bottom + 5;
  const top = below + menuHeight <= panelRect.bottom - 8 ? below : Math.max(panelRect.top + 8, caret.top - menuHeight - 5);
  menu.style.left = `${left}px`; menu.style.top = `${top}px`; menu.style.right = "auto"; menu.style.bottom = "auto";
}

function acceptCompletion(index = state.completionIndex) {
  const item = state.completionItems[index]; if (!item) return;
  const position = currentPosition();
  const before = source.value.slice(0, source.selectionStart);
  const current = before.slice(position.start);
  let replaceStart = position.start;
  if (item.icon === "@") {
    const token = current.match(/@?[A-Za-z0-9._'-]*$/)?.[0] || "";
    replaceStart = source.selectionStart - token.length;
  } else if (/\s-\s/.test(current)) replaceStart = position.start + current.lastIndexOf("-") + 2;
  else if (current.trim()) replaceStart = position.start + current.search(/\S/);
  const suffix = item.icon === "@" ? "\n" : "";
  source.setRangeText(item.value + suffix, replaceStart, source.selectionStart, "end");
  hideCompletions(); sourceChanged();
}

async function newFile() {
  if (!(await confirmDiscard())) return;
  state.handle = null; setDocument(BLANK_TEMPLATE, "Untitled.fountain", true); source.focus();
}

async function confirmDiscard() {
  return !document.body.classList.contains("dirty") || window.confirm("Discard unsaved screenplay changes?");
}

async function openFile() {
  if (!(await confirmDiscard())) return;
  if (window.showOpenFilePicker) {
    try {
      [state.handle] = await window.showOpenFilePicker({ types: [{ description: "Fountain screenplay", accept: { "text/plain": [".fountain", ".txt"] } }], multiple: false });
      const file = await state.handle.getFile(); setDocument(await file.text(), file.name, true); return;
    } catch (error) { if (error.name !== "AbortError") toast(error.message); return; }
  }
  $("#file-input").click();
}

function setDocument(text, filename, saved = false, githubFile = null) {
  source.value = text; state.history = [text]; state.historyIndex = 0; state.filename = filename || "Untitled.fountain"; if (saved) state.savedSource = text;
  state.lastSourceValue = text;
  state.githubFile = githubFile;
  $("#filename").textContent = state.filename; document.title = `${state.filename} — Fountain Publisher`; sourceChanged({ rebaseBeats: false });
}

async function saveFile(saveAs = false) {
  try {
    if (window.showSaveFilePicker && (saveAs || !state.handle)) {
      state.handle = await window.showSaveFilePicker({ suggestedName: normalizedFilename("fountain"), types: [{ description: "Fountain screenplay", accept: { "text/plain": [".fountain"] } }] });
    }
    if (state.handle) {
      const writable = await state.handle.createWritable(); await writable.write(source.value); await writable.close();
      const file = await state.handle.getFile(); state.filename = file.name;
    } else {
      await download(new Blob([source.value], { type: "text/plain;charset=utf-8" }), normalizedFilename("fountain"));
    }
    state.savedSource = source.value; setDocument(source.value, state.filename, true); toast(`Saved ${state.filename}`);
  } catch (error) { if (error.name !== "AbortError") toast(error.message); }
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, { credentials: "include", ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `GitHub request failed (${response.status})`);
  return result;
}

function updateGithubMenu() {
  $("#github-connect").textContent = state.githubConnected ? "GitHub browser…" : "Connect GitHub…";
  $("#github-open").disabled = !state.githubConnected;
  $("#github-save").disabled = !state.githubConnected;
}

async function refreshGithubSession({ notify = false } = {}) {
  try {
    const session = await githubRequest("/api/session");
    state.githubConnected = true;
    state.githubInstallUrl = session.installUrl;
    $("#github-account").textContent = `Connected as ${session.login}`;
    if (notify) toast(`Connected to GitHub as ${session.login}`);
  } catch {
    state.githubConnected = false;
    state.githubInstallUrl = "";
    $("#github-account").textContent = "Not connected";
  }
  updateGithubMenu();
  return state.githubConnected;
}

function openGithubPopup(url) {
  const width = Math.min(480, screen.availWidth - 24);
  const height = Math.min(640, screen.availHeight - 24);
  const popup = window.open(url, "fountain-publisher-github", `popup,width=${width},height=${height}`);
  if (!popup) toast("Allow popups to connect GitHub");
  return popup;
}

async function waitForGithubPopup(popup) {
  const startedAt = Date.now();
  while (popup && !popup.closed && Date.now() - startedAt < 120000) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (!popup || !popup.closed) return toast("GitHub connection timed out");
  // GitHub may apply Cross-Origin-Opener-Policy while authorizing, which can
  // sever window.opener and prevent the callback page's postMessage. The
  // HttpOnly session cookie is authoritative, so verify it after the popup closes.
  if (state.githubConnected) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await refreshGithubSession({ notify: true })) return openGithubBrowser();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  toast("GitHub connection did not complete. Please try again.");
}

async function connectGithub() {
  if (state.githubConnected) return openGithubBrowser();
  const popup = openGithubPopup(`${GITHUB_API}/auth/github/start`);
  if (popup) void waitForGithubPopup(popup);
}

function selectedGithubRepository() {
  const fullName = $("#github-repository").value.trim();
  const repository = state.githubRepositories.find((item) => item.fullName === fullName);
  if (!repository) return null;
  const [owner, repo] = fullName.split("/");
  return { ...repository, owner, repo };
}

function readGithubBrowserLocation() {
  try {
    const location = JSON.parse(localStorage.getItem(GITHUB_BROWSER_KEY) || "null");
    if (typeof location?.repository === "string" && typeof location?.path === "string") return location;
  } catch { /* Fall back to this tab's confirmed location. */ }
  return state.githubRepository ? { repository: state.githubRepository, branch: state.githubBranch, path: state.githubPath } : null;
}

function rememberGithubBrowserLocation() {
  const repository = selectedGithubRepository();
  const branch = $("#github-branch").value;
  if (!repository || !branch) return;
  const location = { repository: repository.fullName, branch, path: state.githubPath };
  state.githubRepository = location.repository;
  state.githubBranch = location.branch;
  try {
    localStorage.setItem(GITHUB_BROWSER_KEY, JSON.stringify(location));
  } catch { /* Browsing must continue if private mode blocks local storage. */ }
}

function renderGithubRepositories() {
  $("#github-repositories").innerHTML = state.githubRepositories.map((repo) => `<option value="${escapeHtml(repo.fullName)}">${repo.private ? "Private" : "Public"}</option>`).join("");
  $("#github-repository").disabled = !state.githubRepositories.length;
}

function githubContentPath(path = state.githubPath, repository = selectedGithubRepository(), branch = $("#github-branch").value) {
  if (!repository) return "";
  return `/api/contents?${new URLSearchParams({ owner: repository.owner, repo: repository.repo, branch, path })}`;
}

function renderGithubBreadcrumbs() {
  const parts = state.githubPath ? state.githubPath.split("/") : [];
  const items = [`<button type="button" data-github-path="">Root</button>`];
  parts.forEach((part, index) => {
    items.push("<span>/</span>", `<button type="button" data-github-path="${escapeHtml(parts.slice(0, index + 1).join("/"))}">${escapeHtml(part)}</button>`);
  });
  $("#github-breadcrumbs").innerHTML = items.join("");
}

function renderGithubColumns({ animate = true } = {}) {
  const fileAction = state.githubBrowserMode === "save" ? "Select" : "Open";
  $("#github-files").innerHTML = state.githubColumns.map((column, index) => {
    const selectedPath = state.githubColumns[index + 1]?.path;
    const entries = column.entries.map((entry) => `<button type="button" role="listitem" data-github-entry="${escapeHtml(entry.path)}" data-github-type="${entry.type}"${entry.path === selectedPath ? ` class="selected" aria-current="true"` : ""}><span aria-hidden="true">${entry.type === "dir" ? "▸" : "F"}</span><span>${escapeHtml(entry.name)}</span><small>${entry.type === "dir" ? "Folder" : fileAction}</small></button>`).join("");
    return `<div class="github-column" data-github-column="${escapeHtml(column.path)}">${entries || `<div class="github-empty">No Fountain files in this folder.</div>`}</div>`;
  }).join("");
  $("#github-files").lastElementChild?.scrollIntoView({ behavior: animate ? "smooth" : "auto", block: "nearest", inline: "end" });
}

async function loadGithubFiles(path = "", { remember = true, render = true, animate = true } = {}) {
  const revision = ++state.githubFilesRevision;
  const repository = selectedGithubRepository();
  const branch = $("#github-branch").value;
  const files = $("#github-files");
  $("#github-save-here").disabled = true;
  if (!path && render) files.innerHTML = `<div class="github-column"><div class="github-empty">Loading repository…</div></div>`;
  try {
    const result = await githubRequest(githubContentPath(path));
    if (revision !== state.githubFilesRevision || selectedGithubRepository()?.fullName !== repository?.fullName || $("#github-branch").value !== branch) return false;
    const entries = (Array.isArray(result) ? result : [result])
      .filter((entry) => entry.type === "dir" || /\.(fountain|txt)$/i.test(entry.name))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    const parentPath = path.split("/").slice(0, -1).join("/");
    const parentIndex = path ? state.githubColumns.findIndex((column) => column.path === parentPath) : -1;
    state.githubColumns = path && parentIndex >= 0
      ? [...state.githubColumns.slice(0, parentIndex + 1), { path, entries }]
      : [{ path, entries }];
    state.githubPath = path;
    if (remember) rememberGithubBrowserLocation();
    if (render) {
      renderGithubBreadcrumbs();
      renderGithubColumns({ animate });
    }
    return true;
  } catch (error) {
    if (revision === state.githubFilesRevision) files.innerHTML = `<div class="github-column"><div class="github-empty">${escapeHtml(error.message)}</div></div>`;
    return false;
  } finally {
    if (revision === state.githubFilesRevision) $("#github-save-here").disabled = false;
  }
}

async function loadGithubFolderPath(path = "") {
  $("#github-files").innerHTML = `<div class="github-column"><div class="github-empty">Loading repository…</div></div>`;
  if (!(await loadGithubFiles("", { remember: !path, render: !path, animate: false }))) return;
  let revision = state.githubFilesRevision;
  if (!path) return;
  const parts = path.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    const finalFolder = index === parts.length - 1;
    if (revision !== state.githubFilesRevision || !(await loadGithubFiles(parts.slice(0, index + 1).join("/"), { remember: finalFolder, render: finalFolder, animate: false }))) {
      return;
    }
    revision = state.githubFilesRevision;
  }
}

async function loadGithubBranches(path = "", rememberedBranch = "") {
  const revision = ++state.githubFilesRevision;
  const repository = selectedGithubRepository();
  if (!repository) return;
  $("#github-save-here").disabled = true;
  try {
    const result = await githubRequest(`/api/branches?${new URLSearchParams({ owner: repository.owner, repo: repository.repo })}`);
    if (revision !== state.githubFilesRevision || selectedGithubRepository()?.fullName !== repository.fullName) return;
    const availableBranches = result.branches;
    const branch = [rememberedBranch, repository.defaultBranch, result.defaultBranch, "main"]
      .find((candidate) => candidate && availableBranches.includes(candidate)) || availableBranches[0] || "";
    state.githubBranches = availableBranches;
    $("#github-branches").innerHTML = availableBranches.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
    $("#github-branch").value = branch;
    state.githubColumns = [];
    await loadGithubFolderPath(path);
  } finally {
    if (revision === state.githubFilesRevision) $("#github-save-here").disabled = false;
  }
}

async function loadGithubRepositories() {
  const result = await githubRequest("/api/repositories");
  state.githubInstallUrl = result.installUrl;
  state.githubRepositories = result.repositories;
  $("#github-install").hidden = false;
  renderGithubRepositories();
  if (!result.repositories.length) {
    $("#github-files").innerHTML = `<div class="github-column"><div class="github-empty">Install Fountain Publisher on at least one repository to browse files.</div></div>`;
    $("#github-branch").value = "";
    return;
  }
  const remembered = readGithubBrowserLocation();
  const repository = remembered && result.repositories.some((repo) => repo.fullName === remembered.repository)
    ? remembered.repository
    : result.repositories[0].fullName;
  $("#github-repository").value = repository;
  const restoreLocation = remembered?.repository === $("#github-repository").value ? remembered : null;
  await loadGithubBranches(restoreLocation?.path || "", restoreLocation?.branch || "");
}

async function openGithubBrowser(mode = "open") {
  if (!state.githubConnected && !(await refreshGithubSession())) return connectGithub();
  closeMenus();
  prepareGithubKeyboardInputs();
  state.githubBrowserMode = mode;
  $("#github-dialog-title").textContent = mode === "save" ? "Save to GitHub" : "Open from GitHub";
  $("#github-save-panel").hidden = mode !== "save";
  if (mode === "save") {
    $("#github-filename").value = normalizedFilename("fountain");
    $("#github-save-status").textContent = "";
  }
  $("#github-save-details").open = mode === "save" && !matchMedia("(max-width: 820px)").matches;
  $("#github-dialog").showModal();
  try { await loadGithubRepositories(); } catch (error) { toast(error.message); }
}

function prepareGithubKeyboardInputs() {
  const dialog = $("#github-dialog");
  if (navigator.maxTouchPoints > 0) {
    [$("#github-repository"), $("#github-branch")].forEach((input) => input.removeAttribute("list"));
  }
  if (dialog.dataset.keyboardReady) return;
  dialog.dataset.keyboardReady = "true";
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.addEventListener("beforeinput", (event) => event.stopPropagation());
  dialog.addEventListener("pointerup", (event) => {
    const input = event.target.closest("input, textarea");
    if (!input || document.activeElement === input) return;
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  });
}

function decodeGithubContent(content) {
  const binary = atob(content.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function openGithubFile(path, trigger) {
  if (!(await confirmDiscard())) return;
  if (trigger) {
    trigger.disabled = true;
    trigger.setAttribute("aria-busy", "true");
    trigger.querySelector("small").textContent = "Opening…";
  }
  try {
    const repository = selectedGithubRepository();
    const branch = $("#github-branch").value;
    const file = await githubRequest(githubContentPath(path));
    const remote = { owner: repository.owner, repo: repository.repo, branch, path, sha: file.sha };
    state.handle = null;
    setDocument(decodeGithubContent(file.content), file.name, true, remote);
    $("#github-dialog").close();
    toast(`Opened ${repository.fullName}/${path}`);
  } catch (error) {
    toast(error.message);
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
      trigger.querySelector("small").textContent = "Open";
    }
  }
}

async function saveGithubFile() {
  const repository = selectedGithubRepository();
  const branch = $("#github-branch").value;
  const folder = state.githubPath;
  const filename = $("#github-filename").value.trim();
  const message = $("#github-commit-message").value.trim();
  if (!repository || repository.fullName !== state.githubRepository || branch !== state.githubBranch) return toast("Choose a loaded repository and branch");
  if (!/^[^/]+\.(fountain|txt)$/i.test(filename)) return toast("Enter a .fountain file name");
  const path = [folder, filename].filter(Boolean).join("/");
  const linked = state.githubFile;
  const existing = state.githubColumns.find((column) => column.path === folder)?.entries.find((entry) => entry.type === "file" && entry.path === path);
  const sha = linked && linked.owner === repository.owner && linked.repo === repository.repo && linked.branch === branch && linked.path === path
    ? linked.sha
    : existing?.sha;
  const button = $("#github-save-here");
  const status = $("#github-save-status");
  button.disabled = true;
  button.textContent = "Saving…";
  status.className = "";
  status.textContent = `Saving to ${repository.fullName} · ${branch} · ${folder || "Root"}…`;
  try {
    const result = await githubRequest(githubContentPath(path, repository, branch), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: source.value, message: message || `Update ${filename}`, sha }),
    });
    if (!result.sha || !result.commit) throw new Error("GitHub did not confirm the commit");
    const saved = await githubRequest(githubContentPath(path, repository, branch));
    if (saved.sha !== result.sha) throw new Error("GitHub could not verify the saved file");
    state.githubFile = { owner: repository.owner, repo: repository.repo, branch, path, sha: result.sha };
    state.filename = filename;
    state.savedSource = source.value;
    $("#filename").textContent = filename;
    document.title = `${filename} — Fountain Publisher`;
    document.body.classList.remove("dirty");
    status.className = "success";
    status.innerHTML = `Saved to ${escapeHtml(branch)} · <a href="${escapeHtml(result.commit)}" target="_blank" rel="noopener noreferrer">View commit</a>`;
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Save here";
  }
}

function normalizedFilename(extension) {
  const base = state.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i, "") || "screenplay";
  return `${base}.${extension}`;
}

async function download(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const shareData = { files: [file], title: filename };
  if (matchMedia("(max-width: 820px)").matches && navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  await download(blob, filename);
}

let screenplainPromise;
async function getBrowserScreenplain() {
  if (!screenplainPromise) screenplainPromise = (async () => {
    $("#compile-status").textContent = "Loading Screenplain…";
    const runtimeBase = new URL("pyodide/", import.meta.url);
    const { loadPyodide } = await import(new URL("pyodide.mjs", runtimeBase).href);
    const pyodide = await loadPyodide({ indexURL: runtimeBase.href });
    await pyodide.loadPackage("micropip");
    pyodide.globals.set("_fp_charset_wheel", new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_reportlab_wheel", new URL("vendor/reportlab-5.0.1-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_pillow_wheel", new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl", import.meta.url).href);
    pyodide.globals.set("_fp_screenplain_wheel", new URL("vendor/screenplain-0.12.0-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_six_wheel", new URL("vendor/six-1.17.0-py2.py3-none-any.whl", import.meta.url).href);
    const fontFiles = [
      "CourierPrime-Regular.ttf",
      "CourierPrime-Bold.ttf",
      "CourierPrime-Italic.ttf",
      "CourierPrime-BoldItalic.ttf",
    ];
    pyodide.FS.mkdirTree("/fonts");
    await Promise.all(fontFiles.map(async (fontFile) => {
      const response = await fetch(new URL(`fonts/${fontFile}`, import.meta.url));
      if (!response.ok) throw new Error(`Unable to load PDF font ${fontFile}`);
      pyodide.FS.writeFile(`/fonts/${fontFile}`, new Uint8Array(await response.arrayBuffer()));
    }));
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(_fp_six_wheel, deps=False)
await micropip.install(_fp_pillow_wheel, deps=False)
await micropip.install(_fp_charset_wheel, deps=False)
await micropip.install(_fp_reportlab_wheel, deps=False)
await micropip.install(_fp_screenplain_wheel, deps=False)
`);
    pyodide.runPython(`
import io
import json
import math
import re
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape as xml_escape
from screenplain.export import fdx, pdf
from screenplain.parsers.fountain import parse
from screenplain.richstring import bold, plain
from screenplain.types import Action, Section, Slug

def _fp_register_pdf_fonts():
    try:
        fonts = {
            "CourierPrime": "/fonts/CourierPrime-Regular.ttf",
            "CourierPrime-Bold": "/fonts/CourierPrime-Bold.ttf",
            "CourierPrime-Italic": "/fonts/CourierPrime-Italic.ttf",
            "CourierPrime-BoldItalic": "/fonts/CourierPrime-BoldItalic.ttf",
        }
        for name, path in fonts.items():
            try:
                pdfmetrics.getFont(name)
            except KeyError:
                pdfmetrics.registerFont(TTFont(name, path))
        pdfmetrics.registerFontFamily(
            "CourierPrime",
            normal="CourierPrime",
            bold="CourierPrime-Bold",
            italic="CourierPrime-Italic",
            boldItalic="CourierPrime-BoldItalic",
        )
        return ("CourierPrime", "CourierPrime", "CourierPrime-Bold", "CourierPrime-Italic", "CourierPrime-BoldItalic")
    except Exception:
        return ("Courier", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique")

def _fp_number_scenes(screenplay, placement="margin", format_type="sequential"):
    if placement == "off":
        for paragraph in screenplay.paragraphs:
            if isinstance(paragraph, Slug):
                paragraph.scene_number = None
        return screenplay
    act_num = 0
    act_scene_num = 0
    sequential = 0
    try:
        from screenplain.types import Section as _Section
    except Exception:
        _Section = None
    for paragraph in screenplay.paragraphs:
        if _Section is not None and isinstance(paragraph, _Section) and getattr(paragraph, "level", 0) == 1:
            act_num += 1
            act_scene_num = 0
        elif isinstance(paragraph, Slug):
            sequential += 1
            act_scene_num += 1
            label = f"A{max(act_num, 1)}S{act_scene_num}" if format_type == "act" else str(sequential)
            if placement == "margin":
                paragraph.scene_number = plain(label)
            else:
                paragraph.line = plain(f"{label}. ") + paragraph.line
                paragraph.scene_number = None
    return screenplay

def _fp_prepare_screenplay(source, placement="margin", format_type="sequential"):
    from screenplain.types import PageBreak
    source = re.sub(r"(?m)^([^\\S\\r\\n]*)>(\\S(?:.*\\S)?)<[^\\S\\r\\n]*$", r"\\1> \\2 <", source)
    screenplay = parse(io.StringIO(source))
    if screenplay.title_page and screenplay.paragraphs and isinstance(screenplay.paragraphs[0], PageBreak):
        del screenplay.paragraphs[0]
    return _fp_number_scenes(screenplay, placement, format_type)

def _fp_format_pdf_act_headings(screenplay):
    screenplay.paragraphs = [
        Slug(bold(str(paragraph.text).upper()), scene_number=None)
        if isinstance(paragraph, Section)
        and getattr(paragraph, "level", 0) == 1
        and re.match(r"^Act\\b", str(paragraph.text), re.IGNORECASE)
        else paragraph
        for paragraph in screenplay.paragraphs
    ]
    return screenplay

def _fp_patch_scene_numbers_left_only():
    try:
        from reportlab.lib.units import inch as _inch
        def _left_only_draw(self):
            self.slug_paragraph.drawOn(self.canv, 0, 0)
            canvas = self.canv
            canvas.saveState()
            canvas.setFont(self.settings.font_settings.family_name, self.settings.font_size)
            canvas.drawString(-0.75 * _inch, 0, self.scene_number)
            canvas.restoreState()
        pdf.SlugWithSceneNumbers.draw = _left_only_draw
    except Exception:
        pass
_fp_patch_scene_numbers_left_only()

def _fp_compile_beat_sheet(title, premise, beats, page_size="letter"):
    output = io.BytesIO()
    _, regular_font, bold_font, _, _ = _fp_register_pdf_fonts()
    selected_size = A4 if page_size == "a4" else letter
    document = SimpleDocTemplate(
        output,
        pagesize=selected_size,
        leftMargin=54,
        rightMargin=54,
        topMargin=58,
        bottomMargin=52,
        title=f"{title} - Beat Sheet",
        author="Fountain Publisher",
    )
    ink = colors.HexColor("#22252a")
    muted = colors.HexColor("#66707a")
    accent = colors.HexColor("#67516c")
    soft = colors.HexColor("#f4f0f5")
    rule = colors.HexColor("#d9d5da")
    title_style = ParagraphStyle("BeatTitle", fontName=bold_font, fontSize=21, leading=25, textColor=ink, spaceAfter=5)
    eyebrow_style = ParagraphStyle("BeatEyebrow", fontName=bold_font, fontSize=8, leading=10, textColor=accent, tracking=1.6, spaceAfter=6)
    premise_style = ParagraphStyle("BeatPremise", fontName=regular_font, fontSize=10.5, leading=15, textColor=ink)
    beat_style = ParagraphStyle("BeatBody", fontName=regular_font, fontSize=11, leading=15, textColor=ink)
    number_style = ParagraphStyle("BeatNumber", fontName=bold_font, fontSize=10, leading=14, textColor=accent, alignment=TA_CENTER)
    story = [
        Paragraph("BEAT SHEET", eyebrow_style),
        Paragraph(xml_escape(title), title_style),
        Spacer(1, 16),
        Paragraph("PREMISE", eyebrow_style),
        Table([[Paragraph(xml_escape(premise) if premise else "No premise yet.", premise_style)]], colWidths=[document.width], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), soft),
            ("BOX", (0, 0), (-1, -1), 0.7, rule),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])),
        Spacer(1, 22),
        Paragraph("STORY BEATS", eyebrow_style),
    ]
    if beats:
        for index, beat in enumerate(beats, 1):
            row = Table(
                [[Paragraph(str(index), number_style), Paragraph(xml_escape(str(beat)), beat_style)]],
                colWidths=[34, document.width - 34],
                style=TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.6, rule),
                    ("LEFTPADDING", (0, 0), (0, 0), 0),
                    ("RIGHTPADDING", (0, 0), (0, 0), 8),
                    ("LEFTPADDING", (1, 0), (1, 0), 7),
                    ("RIGHTPADDING", (1, 0), (1, 0), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                ]),
            )
            story.append(KeepTogether([row]))
    else:
        story.append(Paragraph("No beats yet.", premise_style))

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(rule)
        canvas.line(doc.leftMargin, 34, selected_size[0] - doc.rightMargin, 34)
        canvas.setFont(regular_font, 8)
        canvas.setFillColor(muted)
        canvas.drawString(doc.leftMargin, 22, "Fountain Publisher")
        canvas.drawRightString(selected_size[0] - doc.rightMargin, 22, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    return output.getvalue()

def _fp_compile(source, kind, page_size, scene_numbers="margin", scene_number_format="sequential"):
    global _fp_last_page_eighths
    _fp_last_page_eighths = 0
    screenplay = _fp_prepare_screenplay(source, scene_numbers, scene_number_format)
    font_family, regular_font, bold_font, italic_font, bold_italic_font = _fp_register_pdf_fonts()
    if kind == "pdf":
        screenplay = _fp_format_pdf_act_headings(screenplay)
        output = io.BytesIO()
        settings = pdf.Settings(page_size=A4 if page_size == "a4" else letter, strong_slugs=False)
        font_settings = getattr(settings, "font_settings", None)
        if font_settings is not None:
            font_settings.family_name = font_family
            font_settings.regular = regular_font
            font_settings.bold = bold_font
            font_settings.italic = italic_font
            font_settings.bold_italic = bold_italic_font
        if hasattr(settings, "slug_style"):
            settings.slug_style.fontName = bold_font
        settings.title_style.fontSize = settings.font_size
        title_leading = settings.line_height * 2
        for style_name in ("title_style", "centered_style", "default_style", "contact_style"):
            style = getattr(settings, style_name, None)
            if style is not None:
                style.fontName = regular_font
                style.fontSize = settings.font_size
                style.leading = title_leading
        if hasattr(settings, "title_style"):
            settings.title_style.spaceAfter = -settings.line_height
        if hasattr(settings, "default_style"):
            settings.default_style.spaceAfter = -settings.line_height
        if hasattr(settings, "contact_style"):
            settings.contact_style.spaceAfter = -settings.line_height
        usage = {"page": 0, "used": 0.0}
        class NumberedDocTemplate(pdf.DocTemplate):
            def handle_pageBegin(self):
                _font_settings = getattr(self.settings, "font_settings", None)
                self.canv.setFont(getattr(_font_settings, "family_name", "Courier"), self.settings.font_size, leading=self.settings.line_height)
                page = self.page if self.has_title_page else self.page + 1
                if page >= 1:
                    self.canv.drawRightString(self.settings.left_margin + self.settings.frame_width, self.settings.page_height - 42, f"{page}.")
                self._handle_pageBegin()
            def afterFlowable(self, flowable):
                title_pages = 1 if self.has_title_page else 0
                content_page = self.page - title_pages
                if content_page < 1 or type(flowable).__name__ in {"LCActionFlowable", "NextPageTemplate", "PageBreak"}:
                    return
                frame = getattr(self, "frame", None)
                if frame is None:
                    return
                used = max(0.0, min(self.settings.frame_height, frame._y2 - frame._y))
                if content_page > usage["page"]:
                    usage.update(page=content_page, used=used)
                elif content_page == usage["page"]:
                    usage["used"] = max(usage["used"], used)
        pdf.to_pdf(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings)
        _fp_last_page_eighths = min(8, max(1, math.ceil(usage["used"] / settings.frame_height * 8))) if usage["page"] else 0
        return output.getvalue()
    if kind == "fdx":
        output = io.BytesIO()
        try:
            fdx.to_fdx(screenplay, output)
            return output.getvalue()
        except TypeError:
            text = io.StringIO()
            fdx.to_fdx(screenplay, text)
            return text.getvalue().encode("utf-8")
    raise ValueError(f"Unsupported export kind: {kind}")
`);
    $("#compile-status").textContent = "Screenplain ready";
    return pyodide;
  })().catch((error) => {
    screenplainPromise = null;
    throw new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${error.message}`, { cause: error });
  });
  return screenplainPromise;
}

async function compileWithBrowserScreenplain(kind, selectedPageSize) {
  const pyodide = await getBrowserScreenplain();
  pyodide.globals.set("_fp_source", source.value);
  pyodide.globals.set("_fp_kind", kind);
  pyodide.globals.set("_fp_page_size", selectedPageSize);
  pyodide.globals.set("_fp_scene_numbers", docSettings.sceneNumbers);
  pyodide.globals.set("_fp_scene_number_format", docSettings.sceneNumberFormat);
  const value = pyodide.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)");
  state.browserLastPageEighths = Number(pyodide.globals.get("_fp_last_page_eighths")) || 0;
  const bytes = value instanceof Uint8Array ? value : value.toJs();
  value.destroy?.();
  const types = { pdf: "application/pdf", fdx: "application/xml;charset=utf-8" };
  return new Blob([bytes], { type: types[kind] });
}

async function compileBeatSheetPdf(title, premise, beats, selectedPageSize = $("#page-size").value) {
  const pyodide = await getBrowserScreenplain();
  pyodide.globals.set("_fp_beat_title", title);
  pyodide.globals.set("_fp_beat_premise", premise);
  pyodide.globals.set("_fp_beat_json", JSON.stringify(beats));
  pyodide.globals.set("_fp_beat_page_size", selectedPageSize);
  const value = pyodide.runPython("_fp_compile_beat_sheet(_fp_beat_title, _fp_beat_premise, json.loads(_fp_beat_json), _fp_beat_page_size)");
  const bytes = value instanceof Uint8Array ? value : value.toJs();
  value.destroy?.();
  return new Blob([bytes], { type: "application/pdf" });
}

async function exportBeatSheetPdf() {
  const button = $("#export-beat-sheet");
  const premise = $("#beat-premise").value.trim();
  const beats = currentBeatCards().map((beat) => beat.text).filter(Boolean);
  const title = state.filename.replace(/\.(fountain|txt)$/i, "") || "Untitled";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const blob = await compileBeatSheetPdf(title, premise, beats);
    await shareOrDownload(blob, `${title} - Beat Sheet.pdf`);
    toast("Beat Sheet PDF exported");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function shouldUseBrowserCompiler(response, expectedType) {
  return [404, 405].includes(response.status) || !response.headers.get("Content-Type")?.includes(expectedType);
}

function compileBinaryWithBrowser(path, selectedPageSize) {
  const kind = path === "/api/render/pdf" ? "pdf" : "fdx";
  return compileWithBrowserScreenplain(kind, selectedPageSize);
}

async function requestBinary(path, selectedPageSize = $("#page-size").value) {
  if (STATIC_HOST) return compileBinaryWithBrowser(path, selectedPageSize);
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.value, pageSize: selectedPageSize, sceneNumbers: docSettings.sceneNumbers, sceneNumberFormat: docSettings.sceneNumberFormat }) });
  const expectedType = path === "/api/render/pdf" ? "application/pdf" : "application/xml";
  if (shouldUseBrowserCompiler(response, expectedType)) {
    STATIC_HOST = true;
    return compileBinaryWithBrowser(path, selectedPageSize);
  }
  if (!response.ok) { const value = await response.json().catch(() => ({})); throw new Error(value.error || "Export failed"); }
  return response.blob();
}

async function exportDocument(format) {
  $("#confirm-export").disabled = true;
  try {
    const blob = format === "pdf"
      ? await requestBinary("/api/render/pdf", $("#export-page-size").value)
      : await requestBinary("/api/export/fdx");
    await shareOrDownload(blob, normalizedFilename(format)); $("#export-dialog").close(); toast(`Exported ${format.toUpperCase()}`);
  } catch (error) { if (error.name !== "AbortError") toast(error.message); }
  finally { $("#confirm-export").disabled = false; }
}

function openExport(format) {
  $("#export-format").value = format; $("#export-page-size").value = $("#page-size").value; $("#dialog-page-size").hidden = format !== "pdf"; $("#export-dialog").showModal();
}

function isMobilePreview() {
  return matchMedia("(max-width: 820px)").matches;
}

function shouldAutofocusSource() {
  return navigator.maxTouchPoints === 0;
}

async function setPreviewMode(mode) {
  if (!['source', 'live', 'pdf', 'beats'].includes(mode)) mode = "live";
  if (mode === "source" && !sourceTabEnabled()) mode = "live";
  if (isMobilePreview() && mode === "pdf") mode = "live";
  const preview = $("#preview-scroll");
  const returnToLive = state.previewMode === "pdf" && mode === "live";
  if (state.previewMode === "live" && mode === "pdf") {
    state.livePreviewScrollTop = preview.scrollTop;
    state.livePreviewScrollLeft = preview.scrollLeft;
  }
  state.previewMode = mode; localStorage.setItem("fountain-publisher.preview", mode);
  const mobilePanel = mode === "source" ? "source" : mode === "beats" ? "beats" : "preview";
  document.body.dataset.mobileTab = mobilePanel;
  localStorage.setItem("fountain-publisher.mobile-tab", mobilePanel);
  $$('[data-preview-mode]').forEach((button) => { button.classList.toggle("active", button.dataset.previewMode === mode); const check = $(".menu-check", button); if (check) check.textContent = button.dataset.previewMode === mode ? "✓" : ""; });
  $("#source-panel").hidden = mode !== "source";
  $(".preview-panel").hidden = !["live", "pdf"].includes(mode);
  $("#beat-sheet-panel").hidden = mode !== "beats";
  $("#preview-page-stage").hidden = mode !== "live"; page.hidden = mode !== "live"; $("#empty-state").hidden = mode !== "live" || Boolean(source.value.trim()); $("#pdf-view").hidden = mode !== "pdf";
  $("#preview-scroll").classList.toggle("pdf-mode", mode === "pdf");
  renderBeatGuide();
  requestAnimationFrame(applyZoom);
  scheduleWorkspaceCache();
  if (mode === "source") {
    renderEditorChrome();
    if (shouldAutofocusSource()) source.focus({ preventScroll: true });
  }
  if (mode === "beats") renderBeatSheetView();
  if (mode === "pdf") await refreshPdf();
  else if (returnToLive) requestAnimationFrame(() => requestAnimationFrame(() => {
    preview.scrollTop = state.livePreviewScrollTop;
    preview.scrollLeft = state.livePreviewScrollLeft;
    clampPreviewScroll(preview);
  }));
}

async function refreshPdf() {
  $("#pdf-placeholder").hidden = false; $("#pdf-frame").hidden = true;
  try {
    const blob = await requestBinary("/api/render/pdf"); if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl); state.pdfUrl = URL.createObjectURL(blob);
    $("#pdf-frame").src = state.pdfUrl; $("#pdf-frame").hidden = false; $("#pdf-placeholder").hidden = true;
  } catch (error) { $("#pdf-placeholder").innerHTML = `<strong>PDF preview unavailable</strong><span>${escapeHtml(error.message)}</span>`; }
}

function setTheme(theme) {
  state.theme = theme; localStorage.setItem("fountain-publisher.theme", theme);
  if (theme === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = theme;
  const effective = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  document.documentElement.dataset.effectiveTheme = effective;
  $("#app-theme-color").content = effective === "dark" ? "#202326" : "#f8f8f7";
  $("#theme-value").textContent = effective[0].toUpperCase() + effective.slice(1);
  $("#theme").title = `Switch to ${effective === "dark" ? "light" : "dark"} mode`;
}

matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (state.theme === "system") setTheme("system");
});

function cycleTheme() {
  const effective = document.documentElement.dataset.effectiveTheme || "light";
  setTheme(effective === "dark" ? "light" : "dark");
}

function isStandaloneApp() {
  return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function updateAppWindowControls() {
  const fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const fullscreenButton = $("#toggle-fullscreen");
  const fullscreenSupported = Boolean(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  fullscreenButton.hidden = isStandaloneApp() || !fullscreenSupported;
  fullscreenButton.textContent = fullscreen ? "Exit full screen" : "Enter full screen";
  $("#install-app").hidden = !installPrompt || isStandaloneApp();
}

async function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
  } else {
    await (document.documentElement.requestFullscreen?.({ navigationUI: "hide" }) || document.documentElement.webkitRequestFullscreen?.());
  }
  updateAppWindowControls();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  updateAppWindowControls();
});
window.addEventListener("appinstalled", () => { installPrompt = null; updateAppWindowControls(); });
document.addEventListener("fullscreenchange", updateAppWindowControls);
document.addEventListener("webkitfullscreenchange", updateAppWindowControls);

function togglePanel(panel, force) {
  const collapsed = force ?? !document.body.classList.contains(`${panel}-collapsed`);
  document.body.classList.toggle(`${panel}-collapsed`, collapsed); localStorage.setItem(`fountain-publisher.${panel}-collapsed`, String(collapsed));
  $$(`[data-toggle-${panel}]`).forEach((button) => button.setAttribute("aria-expanded", String(!collapsed)));
  $(`#menu-toggle-${panel}`).textContent = `${collapsed ? "Show" : "Hide"} ${panel === "stats" ? "Insights" : "Source"}`;
  if (state.previewZoom === "fit") requestAnimationFrame(applyZoom);
}

function installResizer(element, variable, side, min, max) {
  let startX = 0; let startWidth = 0;
  const apply = (width) => { const next = Math.max(min, Math.min(max, width)); document.documentElement.style.setProperty(variable, `${next}px`); localStorage.setItem(`fountain-publisher.${variable}`, String(next)); element.setAttribute("aria-valuenow", String(Math.round(next))); if (variable === "--source-w") renderEditorChrome(); if (state.previewZoom === "fit") requestAnimationFrame(applyZoom); };
  element.addEventListener("pointerdown", (event) => { startX = event.clientX; startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable)); element.setPointerCapture(event.pointerId); });
  element.addEventListener("pointermove", (event) => { if (!element.hasPointerCapture(event.pointerId)) return; apply(startWidth + (event.clientX - startX) * side); });
  element.addEventListener("dblclick", () => apply(variable === "--source-w" ? 370 : 330));
  element.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable)); if (event.key === "Home") apply(min); else if (event.key === "End") apply(max); else apply(current + (event.key === "ArrowRight" ? 1 : -1) * side * (event.shiftKey ? 30 : 10)); });
}

function clampPreviewScroll(preview = $("#preview-scroll")) {
  const maxTop = Math.max(0, preview.scrollHeight - preview.clientHeight);
  const maxLeft = Math.max(0, preview.scrollWidth - preview.clientWidth);
  preview.scrollTop = Math.max(0, Math.min(preview.scrollTop, maxTop));
  preview.scrollLeft = Math.max(0, Math.min(preview.scrollLeft, maxLeft));
}

function applyZoom() {
  const zoom = state.previewZoom;
  const zoomControl = $("#zoom");
  const fitOption = $("#zoom-fit-value");
  $$('[data-zoom-fit]').forEach((button) => button.setAttribute("aria-pressed", String(zoom === "fit")));
  if (isMobilePreview()) {
    const scale = zoom === "fit" ? 1 : Number(zoom) / 100;
    fitOption.hidden = zoom !== "fit";
    if (zoom === "fit") { fitOption.textContent = "100%"; zoomControl.value = "fit"; }
    else zoomControl.value = zoom;
    page.style.transform = "none"; page.style.marginBottom = "0"; page.style.marginRight = "0";
    $("#preview-page-stage").style.removeProperty("width");
    $("#preview-page-stage").style.removeProperty("min-height");
    page.style.setProperty("--mobile-preview-zoom", scale);
    requestAnimationFrame(() => { clampPreviewScroll(); alignAnnotationOrbs(); });
    scheduleWorkspaceCache();
    return;
  }
  page.style.removeProperty("--mobile-preview-zoom");
  let scale = Number(zoom) / 100;
  if (zoom === "fit") {
    const preview = $("#preview-scroll");
    const style = getComputedStyle(preview);
    const panelWidth = state.previewMode === "source" ? $("#source-panel").clientWidth : state.previewMode === "beats" ? $("#beat-sheet-panel").clientWidth : preview.clientWidth;
    const availableWidth = ["source", "beats"].includes(state.previewMode) ? panelWidth - 40 : panelWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    scale = Math.max(.25, Math.min(2, availableWidth / 816));
  }
  fitOption.hidden = zoom !== "fit";
  if (zoom === "fit") {
    fitOption.textContent = `${Math.round(scale * 100)}%`;
    zoomControl.value = "fit";
  } else zoomControl.value = zoom;
  $$('[data-workspace-zoom]').forEach((control) => {
    const option = $('option[value="fit"]', control);
    option.hidden = zoom !== "fit";
    if (zoom === "fit") option.textContent = `${Math.round(scale * 100)}%`;
    control.value = zoom === "fit" ? "fit" : zoom;
  });
  document.documentElement.style.setProperty("--workspace-zoom", scale);
  const stage = $("#preview-page-stage");
  stage.style.width = `${816 * scale}px`; stage.style.minHeight = `${Math.max(1056, page.scrollHeight) * scale}px`;
  page.style.transform = `scale(${scale})`; page.style.marginBottom = "0"; page.style.marginRight = "0";
  const preview = $("#preview-scroll");
  requestAnimationFrame(() => {
    preview.scrollLeft = Math.max(0, (preview.scrollWidth - preview.clientWidth) / 2);
    clampPreviewScroll(preview);
    alignAnnotationOrbs();
  });
  scheduleWorkspaceCache();
}

function stepZoom(direction) {
  const values = ["70", "85", "100", "115", "130", "150", "175", "200"];
  const zoom = $("#zoom");
  if (state.previewZoom === "fit") {
    const fitPercent = Number.parseInt($("#zoom-fit-value").textContent, 10) || 100;
    const numericValues = values.map(Number);
    const next = direction > 0
      ? numericValues.find((value) => value > fitPercent) ?? numericValues.at(-1)
      : [...numericValues].reverse().find((value) => value < fitPercent) ?? numericValues[0];
    zoom.value = String(next);
    state.previewZoom = zoom.value;
    applyZoom();
    return;
  }
  const index = values.indexOf(zoom.value);
  zoom.value = values[Math.max(0, Math.min(values.length - 1, index + direction))];
  state.previewZoom = zoom.value;
  applyZoom();
}

function jumpToLine(oneBased, focus = true) {
  const lines = source.value.split("\n"); let offset = 0; for (let i = 0; i < Math.max(0, oneBased - 1); i += 1) offset += lines[i].length + 1;
  if (focus) source.focus();
  source.setSelectionRange(offset, offset + (lines[oneBased - 1]?.length || 0)); updateCursor({ scrollPreview: true, scrollBlock: "center" });
  const highlight = $("#source-highlight");
  const sourceLine = $(`[data-source-line="${Math.max(0, oneBased - 1)}"]`, highlight);
  const firstRect = sourceLine?.getClientRects()[0];
  const lineTop = firstRect ? firstRect.top - highlight.getBoundingClientRect().top + highlight.scrollTop : 0;
  source.scrollTop = Math.max(0, lineTop - source.clientHeight / 2);
  $("#line-numbers").scrollTop = source.scrollTop; $("#source-highlight").scrollTop = source.scrollTop; updateCursor({ scrollPreview: true, scrollBlock: "center" });
}

function jumpToInsightScene(oneBased) {
  state.insightLine = oneBased;
  jumpToLine(oneBased, false);
}

let toastTimer;
function toast(message) { const element = $("#toast"); element.textContent = message; element.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("show"), 2200); }

function sourceLines() {
  return source.value.replace(/\r\n?/g, "\n").split("\n");
}

function setSourceLines(lines) {
  const selectionStart = source.selectionStart;
  const selectionEnd = source.selectionEnd;
  const selectionDirection = source.selectionDirection;
  source.value = lines.join("\n").replace(/\n{3,}$/g, "\n\n");
  source.setSelectionRange(
    Math.min(selectionStart, source.value.length),
    Math.min(selectionEnd, source.value.length),
    selectionDirection,
  );
  sourceChanged();
}

function appendManagedNote(value) {
  const lines = sourceLines();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  if (lines.length) lines.push("");
  lines.push(value);
  setSourceLines(lines);
}

function managedGeneralSource(text) {
  return `[[FP-GENERAL:${encodeURIComponent(text)}]]`;
}

function managedCharacterSource(name, text) {
  return `[[FP-CHARACTER:${encodeURIComponent(name)}:${encodeURIComponent(text)}]]`;
}

function managedBeatSheetSource(premise, beats) {
  return `[[FP-BEATS:${encodeURIComponent(JSON.stringify({ premise, beats }))}]]`;
}

function beatCard(beat = { text: "" }) {
  if (typeof beat === "string") beat = { text: beat };
  const range = beat.range || {};
  const assignment = beat.range
    ? `Lines ${beat.range.startLine + 1}–${beat.range.endLine + 1}`
    : "Unassigned";
  const up = `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="m3 8 5-5 5 5"/></svg>`;
  const down = `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="m3 4 5 5 5-5"/></svg>`;
  const jumpAttributes = beat.range ? `data-beat-jump title="Open ${escapeHtml(assignment)} in Preview" aria-label="Open ${escapeHtml(assignment)} in Preview"` : "disabled";
  return `<li class="beat-card beat-graph-node${beat.range ? " assigned" : ""}" data-start-line="${range.startLine ?? ""}" data-end-line="${range.endLine ?? ""}"><div class="beat-shift" role="group" aria-label="Move beat"><button class="beat-up" type="button" aria-label="Move beat up" title="Move up">${up}</button><button class="beat-down" type="button" aria-label="Move beat down" title="Move down">${down}</button></div><button class="beat-number beat-drag" draggable="false" type="button" aria-label="Reorder beat. Drag, or use Up and Down arrow keys" aria-keyshortcuts="ArrowUp ArrowDown Home End" title="Drag or use arrow keys to reorder"></button><div class="beat-node-box"><div class="beat-card-fields"><input class="beat-text" type="text" placeholder="What happens in this beat?" value="${escapeHtml(beat.text)}" /></div><div class="beat-assignment-wrap"><button class="beat-assignment" type="button" ${jumpAttributes}><small>${escapeHtml(assignment)}</small></button>${beat.range ? `<button class="beat-unassign" type="button" aria-label="Unassign beat from screenplay" title="Unassign from screenplay">×</button>` : ""}<button class="beat-remove" type="button" aria-label="Delete beat" title="Delete beat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></div></div></li>`;
}

function screenplayWordProgress() {
  const ignored = new Set(["empty", "parenthetical", "section", "synopsis", "note", "boneyard", "title-value", "title-value title", "character", "scene", "page-break"]);
  const progress = [0];
  let total = 0;
  classifyLines(source.value).forEach((line) => {
    if (!ignored.has(line.type)) total += (line.display.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    progress.push(total);
  });
  return { progress, total };
}

function renderBeatProgressGraph(beats = currentBeatCards()) {
  const graph = $("#beat-progress-graph");
  if (!graph) return;
  const count = beats.length;
  if (!count) { graph.innerHTML = ""; graph.hidden = true; return; }
  graph.hidden = false;
  const { progress, total } = screenplayWordProgress();
  const values = beats.map((beat) => beat.range ? progress[Math.max(0, Math.min(progress.length - 1, beat.range.startLine))] : null);
  const plotted = values.map((value, index) => {
    if (value !== null) return value;
    let before = index - 1;
    while (before >= 0 && values[before] === null) before -= 1;
    let after = index + 1;
    while (after < count && values[after] === null) after += 1;
    const beforeIndex = before >= 0 ? before : -1;
    const beforeValue = before >= 0 ? values[before] : 0;
    const afterIndex = after < count ? after : count;
    const afterValue = after < count ? values[after] : total;
    return Math.round(beforeValue + (afterValue - beforeValue) * ((index - beforeIndex) / (afterIndex - beforeIndex)));
  });
  const width = 720; const height = 190; const left = 48; const right = 18; const top = 18; const bottom = 32;
  const x = (index) => left + (width - left - right) * ((index + 1) / (count + 1));
  const y = (words) => height - bottom - (height - top - bottom) * (total ? words / total : 0);
  const points = [`${left},${y(0)}`, ...plotted.map((words, index) => `${x(index)},${y(words)}`), `${width - right},${y(total)}`].join(" ");
  const circles = beats.map((beat, index) => {
    const assigned = values[index] !== null;
    const words = plotted[index];
    const label = beat.text || `Beat ${index + 1}`;
    return `<g class="beat-plot-point ${assigned ? "assigned" : "unassigned"}"><circle cx="${x(index)}" cy="${y(words)}" r="5"><title>Beat ${index + 1}: ${escapeHtml(label)} · ${words.toLocaleString()} words${assigned ? "" : " (estimated)"}</title></circle><text x="${x(index)}" y="${height - 11}" text-anchor="middle">${index + 1}</text></g>`;
  }).join("");
  const midpoint = Math.round(total / 2);
  graph.innerHTML = `<header><strong>Pacing</strong><span>Cumulative screenplay words at each beat</span><small><i></i> Assigned <i></i> Unassigned estimate</small></header><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Beat pacing graph"><line class="beat-ideal-line" x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(total)}"/><line class="beat-grid-line" x1="${left}" y1="${y(midpoint)}" x2="${width - right}" y2="${y(midpoint)}"/><text class="beat-axis-label" x="${left - 7}" y="${y(total) + 3}" text-anchor="end">${total.toLocaleString()}</text><text class="beat-axis-label" x="${left - 7}" y="${y(midpoint) + 3}" text-anchor="end">${midpoint.toLocaleString()}</text><text class="beat-axis-label" x="${left - 7}" y="${y(0) + 3}" text-anchor="end">0</text><polyline class="beat-progress-line" points="${points}"/>${circles}</svg>`;
}

function openBeatProgressGraph() {
  renderBeatProgressGraph();
  $("#beat-progress-dialog").showModal();
}

async function saveBeatProgressPng() {
  renderBeatProgressGraph();
  const sourceSvg = $("#beat-progress-graph svg");
  if (!sourceSvg) { toast("Add a beat before saving the pacing graph"); return; }
  const clone = sourceSvg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const paper = canvasColor("--surface", "#fff");
  const ink = canvasColor("--ink", "#202124");
  const muted = canvasColor("--muted", "#6b7280");
  const accent = canvasColor("--metric-scenes-ink", "#0284c7");
  clone.querySelector(".beat-ideal-line")?.setAttribute("style", `stroke:${muted};stroke-opacity:.35;stroke-width:1;stroke-dasharray:4 5`);
  clone.querySelector(".beat-grid-line")?.setAttribute("style", `stroke:${muted};stroke-opacity:.18;stroke-width:1`);
  clone.querySelector(".beat-progress-line")?.setAttribute("style", `fill:none;stroke:${accent};stroke-width:2;stroke-linejoin:round`);
  clone.querySelectorAll(".beat-plot-point.assigned circle").forEach((circle) => circle.setAttribute("style", `fill:${accent};stroke:${paper};stroke-width:2`));
  clone.querySelectorAll(".beat-plot-point.unassigned circle").forEach((circle) => circle.setAttribute("style", `fill:${paper};stroke:#92979f;stroke-width:2`));
  clone.querySelectorAll("text").forEach((text) => text.setAttribute("style", `fill:${muted};font:8px ui-monospace,monospace`));
  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const image = new Image();
  const url = URL.createObjectURL(svgBlob);
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
  URL.revokeObjectURL(url);
  const canvas = document.createElement("canvas");
  canvas.width = 1440; canvas.height = 440;
  const context = canvas.getContext("2d");
  context.fillStyle = paper; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = ink; context.font = "700 28px -apple-system, BlinkMacSystemFont, sans-serif"; context.fillText("Beat Pacing", 36, 40);
  context.fillStyle = muted; context.font = "18px -apple-system, BlinkMacSystemFont, sans-serif"; context.fillText("Cumulative screenplay words at each beat", 36, 68);
  context.drawImage(image, 0, 60, 1440, 380);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) { toast("Could not create pacing graph image"); return; }
  await download(blob, normalizedFilename("beat-pacing.png"));
  toast("Beat pacing PNG saved");
}

function renumberBeatCards() {
  const cards = $$(".beat-card", $("#beat-list"));
  cards.forEach((card, index) => {
    $(".beat-number", card).textContent = index + 1;
    $(".beat-up", card).disabled = index === 0;
    $(".beat-down", card).disabled = index === cards.length - 1;
  });
  renderBeatProgressGraph();
}

function currentBeatCards() {
  return $$(".beat-card", $("#beat-list")).map((card) => {
    const startLine = card.dataset.startLine === "" ? null : Number(card.dataset.startLine);
    const endLine = card.dataset.endLine === "" ? null : Number(card.dataset.endLine);
    return { text: $(".beat-text", card).value.trim(), range: startLine === null || endLine === null ? null : { startLine, endLine } };
  });
}

function renderBeatSheetView() {
  const sheet = state.metadata.beatSheet || { premise: "", beats: [] };
  const hasBeatSheet = Boolean(sheet.premise?.trim() || sheet.beats.some((beat) => (typeof beat === "string" ? beat : beat.text)?.trim()));
  $("#beat-sheet-empty-state").hidden = hasBeatSheet;
  $("#beat-premise").value = sheet.premise || "";
  $("#beat-list").innerHTML = sheet.beats.map(beatCard).join("");
  renumberBeatCards();
}

function openBeatSheet() {
  void setPreviewMode("beats");
}

function openAnnotationEditor(line = null, insertAfter = null) {
  const existing = line === null ? "" : annotationText(sourceLines()[line] || "");
  state.noteEditor = { kind: "annotation", line, insertAfter };
  $("#annotation-heading").textContent = line === null ? "Add Annotation" : "Edit Annotation";
  $("#annotation-text").value = existing;
  $("#delete-annotation").hidden = line === null;
  $("#annotation-dialog").showModal();
  setTimeout(() => $("#annotation-text").focus(), 0);
}

function hidePreviewContextMenu() {
  const menu = $("#preview-context-menu");
  menu.hidden = true;
  state.previewContextLine = null;
  state.previewContextEdit = null;
  state.previewContextText = "";
  state.contextSurface = null;
  state.contextSelection = null;
  state.contextWord = null;
}

function sourceLineAtOffset(offset) {
  return source.value.slice(0, offset).split("\n").length - 1;
}

function wordAtSourceOffset(offset) {
  const lineStart = source.value.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const lineEnd = source.value.indexOf("\n", offset);
  const end = lineEnd < 0 ? source.value.length : lineEnd;
  const text = source.value.slice(lineStart, end);
  for (const match of text.matchAll(/[\p{L}][\p{L}'’-]*/gu)) {
    const start = lineStart + match.index;
    const finish = start + match[0].length;
    if (offset >= start && offset <= finish) return { word: match[0], start, end: finish };
  }
  return null;
}

async function getSpellchecker() {
  if (state.spellchecker) return state.spellchecker;
  if (!state.spellcheckerPromise) state.spellcheckerPromise = Promise.all([
    import("./vendor/spellcheck.mjs"),
    fetch("./vendor/dictionary-en.aff").then((response) => response.text()),
    fetch("./vendor/dictionary-en.dic").then((response) => response.text()),
  ]).then(([module, aff, dic]) => (state.spellchecker = module.createSpellchecker(aff, dic)));
  return state.spellcheckerPromise;
}

function positionContextMenu(clientX, clientY) {
  const menu = $("#preview-context-menu");
  menu.style.left = "0px";
  menu.style.top = "0px";
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, clientX))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, clientY))}px`;
}

async function renderContextSpelling(clientX, clientY) {
  const container = $("#context-spelling");
  container.hidden = true;
  container.replaceChildren();
  const candidate = state.contextWord;
  if (!$("#spellcheck").checked || !candidate || candidate.word === candidate.word.toUpperCase() || candidate.word.length < 2) return;
  try {
    const checker = await getSpellchecker();
    if (checker.correct(candidate.word) || state.contextWord !== candidate) return;
    const suggestions = checker.suggest(candidate.word).slice(0, 5);
    const label = document.createElement("small");
    label.textContent = suggestions.length ? `Spelling: ${candidate.word}` : `No suggestions for ${candidate.word}`;
    container.append(label);
    suggestions.forEach((suggestion) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "menuitem";
      button.dataset.spellingSuggestion = suggestion;
      button.textContent = suggestion;
      container.append(button);
    });
    container.hidden = false;
    positionContextMenu(clientX, clientY);
  } catch { /* Keep editing actions available if the local dictionary cannot load. */ }
}

function previewLineForNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node.closest?.(".script-line") : node?.parentElement?.closest(".script-line");
}

function previewSelectionInPage() {
  const selection = getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return page.contains(range.commonAncestorContainer) ? selection : null;
}

function placePreviewCaretFromPoint(line, clientX, clientY) {
  const displayOffsetFor = (node, offset) => {
    const displayRange = document.createRange();
    displayRange.selectNodeContents(line);
    displayRange.setEnd(node, offset);
    return displayRange.toString().length;
  };
  const position = document.caretPositionFromPoint?.(clientX, clientY);
  if (position && line.contains(position.offsetNode)) {
    const selection = getSelection();
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    page.focus({ preventScroll: true });
    setSourceCursorFromPreview(line, displayOffsetFor(position.offsetNode, position.offset));
    return;
  }
  const range = document.caretRangeFromPoint?.(clientX, clientY);
  if (range && line.contains(range.startContainer)) {
    const selection = getSelection();
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    page.focus({ preventScroll: true });
    setSourceCursorFromPreview(line, displayOffsetFor(range.startContainer, range.startOffset));
    return;
  }
  page.focus({ preventScroll: true });
  placeCaretAtOffset(line, line.textContent.length);
  setSourceCursorFromPreview(line);
}

function showPreviewContextMenu(line, clientX, clientY, surface = "preview") {
  const menu = $("#preview-context-menu");
  const selection = surface === "preview" ? previewSelectionInPage() : null;
  state.contextSurface = surface;
  state.previewContextLine = surface === "preview" ? Number(line.dataset.line) : sourceLineAtOffset(source.selectionStart);
  state.previewContextEdit = surface === "preview" ? previewSelection(previewLineForNode(selection?.focusNode) || line) : null;
  state.previewContextText = surface === "preview" ? selection?.toString() || "" : source.value.slice(source.selectionStart, source.selectionEnd);
  state.contextSelection = { start: source.selectionStart, end: source.selectionEnd };
  state.contextWord = wordAtSourceOffset(source.selectionStart);
  menu.hidden = false;
  let top = clientY;
  if (surface === "preview" && isMobilePreview() && state.previewContextText && selection?.rangeCount) {
    const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    const height = menu.getBoundingClientRect().height;
    const below = selectionRect.bottom + 12;
    const above = selectionRect.top - height - 12;
    top = below + height <= window.innerHeight - 8 ? below : above;
  }
  positionContextMenu(clientX, top);
  void renderContextSpelling(clientX, top);
}

async function runSourceContextAction(action, context) {
  const { start, end } = context;
  const text = source.value.slice(start, end);
  if (action === "copy" || action === "cut") {
    if (!text) return "Select text to copy";
    try { await navigator.clipboard.writeText(text); } catch { return "Clipboard access was denied"; }
    if (action === "cut") { source.setRangeText("", start, end, "end"); sourceChanged(); }
    return "";
  }
  if (action === "paste") {
    try { source.setRangeText(await navigator.clipboard.readText(), start, end, "end"); sourceChanged(); return ""; }
    catch { return "Clipboard access was denied"; }
  }
  if (action === "select-all") { source.focus(); source.select(); return ""; }
  return "";
}

async function runPreviewClipboardAction(action, lineNumber, context = {}) {
  const line = Number.isInteger(lineNumber) ? $(`[data-line="${lineNumber}"]`, page) : null;
  if (action === "copy") {
    const selection = previewSelectionInPage();
    const text = context.text || selection?.toString() || "";
    if (!text) return "Select text to copy";
    try { if (document.execCommand("copy")) return ""; } catch { /* fall through */ }
    try { await navigator.clipboard.writeText(text); return ""; } catch { return "Clipboard access was denied"; }
  }
  if (action === "cut") {
    const selection = previewSelectionInPage();
    const text = context.text || selection?.toString() || "";
    if (!text) return "Select text to cut";
    const edit = context.edit || previewSelection(previewLineForNode(selection?.focusNode) || line);
    if (!edit) return "Select text to cut";
    try {
      await navigator.clipboard.writeText(text);
      replacePreviewSelection(edit, "");
      return "";
    } catch {
      try {
        if (!document.execCommand("copy")) return "Clipboard access was denied";
        replacePreviewSelection(edit, "");
        return "";
      } catch { return "Clipboard access was denied"; }
    }
  }
  if (action === "paste") {
    const edit = context.edit || previewSelection(line || previewLineForNode(previewSelectionInPage()?.focusNode));
    if (!edit) return "Click where you want to paste";
    try {
      replacePreviewSelection(edit, await navigator.clipboard.readText());
      return "";
    } catch {
      try { return document.execCommand("paste") ? "" : "Clipboard access was denied"; }
      catch { return "Clipboard access was denied"; }
    }
  }
  if (action === "select-all") {
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(page);
    selection?.removeAllRanges();
    selection?.addRange(range);
    page.focus({ preventScroll: true });
    return "";
  }
  return "Clipboard access was denied";
}

function openCharacterNoteEditor(name) {
  const note = state.metadata.characterNotes?.[name];
  state.noteEditor = { kind: "character", name, line: note?.line ?? null };
  $("#character-note-heading").textContent = `${name} notes`;
  $("#character-note-text").value = note?.text || "";
  $("#delete-character-note").hidden = !note;
  $("#character-note-dialog").showModal();
  setTimeout(() => $("#character-note-text").focus(), 0);
}

function openGeneralNoteEditor(line = null) {
  const note = (state.metadata.generalNotes || []).find((item) => item.line === line);
  state.noteEditor = { kind: "general", line: note?.line ?? null };
  $("#general-note-heading").textContent = note ? "Edit general note" : "Add general note";
  $("#general-note-text").value = note?.text || "";
  $("#delete-general-note").hidden = !note;
  $("#general-note-dialog").showModal();
  setTimeout(() => $("#general-note-text").focus(), 0);
}

function deleteNoteLine(line) {
  if (line === null || line === undefined) return;
  const lines = sourceLines();
  lines.splice(line, 1);
  setSourceLines(lines);
}

const toolbarMenus = $$(".toolbar-menu");

function closeMenus(except = null) { toolbarMenus.forEach((menu) => { if (menu !== except) menu.open = false; }); }
function setMobileMenu(open) {
  document.body.classList.toggle("mobile-menu-open", open);
  $("#mobile-menu-toggle").setAttribute("aria-expanded", String(open));
  $("#mobile-menu-toggle").setAttribute("aria-label", open ? "Close menu" : "Open menu");
  if (!open) closeMenus();
}

function vimActive() {
  return state.vimEnabled && !isMobilePreview();
}

function updateVimUi() {
  const active = vimActive();
  const label = state.vimMode.toUpperCase();
  [$("#vim-source-status"), $("#vim-preview-status")].forEach((element) => {
    element.hidden = !active;
    element.textContent = label;
    element.dataset.mode = state.vimMode;
  });
  document.body.classList.toggle("vim-enabled", active);
  document.body.classList.toggle("vim-normal", active && state.vimMode === "normal");
}

function setVimMode(mode) {
  state.vimMode = mode;
  state.vimPending = "";
  hideCompletions(); hidePreviewCompletions();
  updateVimUi();
}

function vimCursorOffset() {
  if (state.vimMode === "visual") return state.vimVisualFocus;
  return source.selectionDirection === "backward" ? source.selectionStart : source.selectionEnd;
}

function vimLinePosition(offset = vimCursorOffset()) {
  const lines = sourceLines();
  const before = source.value.slice(0, offset);
  const line = before.split("\n").length - 1;
  const start = before.lastIndexOf("\n") + 1;
  return { lines, line, start, column: offset - start, end: start + (lines[line]?.length || 0) };
}

function vimVisualRange(anchor = state.vimVisualAnchor, focus = state.vimVisualFocus) {
  return { start: Math.min(anchor, focus), end: Math.min(source.value.length, Math.max(anchor, focus) + 1) };
}

function previewTextPoint(element, offset) {
  let remaining = Math.max(0, Math.min(offset, element.textContent.length));
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && remaining > node.textContent.length) { remaining -= node.textContent.length; node = walker.nextNode(); }
  return node ? { node, offset: remaining } : { node: element, offset: element.childNodes.length };
}

function vimPreviewEndpoint(offset) {
  const position = vimLinePosition(offset);
  const line = $(`[data-line="${position.line}"]`, page);
  if (!previewLineIsEditable(line)) return null;
  return { line, ...previewTextPoint(line, Math.min(position.column, line.textContent.length)) };
}

function focusVimSelection(previewFocus, anchor, focus) {
  state.vimVisualAnchor = anchor;
  state.vimVisualFocus = focus;
  const visual = vimVisualRange(anchor, focus);
  source.setSelectionRange(visual.start, visual.end, focus < anchor ? "backward" : "forward");
  if (!previewFocus) {
    source.focus({ preventScroll: true });
    scrollSourceTarget(vimLinePosition(focus).line);
    updateCursor({ scrollPreview: true });
    return;
  }
  const anchorPoint = vimPreviewEndpoint(Math.min(source.value.length, anchor + (focus < anchor ? 1 : 0)));
  const focusPoint = vimPreviewEndpoint(Math.min(source.value.length, focus + (focus >= anchor ? 1 : 0)));
  if (!anchorPoint || !focusPoint) return;
  page.focus({ preventScroll: true });
  const selection = getSelection(); selection.removeAllRanges();
  selection.setBaseAndExtent(anchorPoint.node, anchorPoint.offset, focusPoint.node, focusPoint.offset);
  scrollPreviewTarget(focusPoint.line);
  updateCursor();
}

function focusVimCursor(previewFocus, offset = source.selectionStart) {
  source.setSelectionRange(offset, offset);
  const position = vimLinePosition(offset);
  if (!previewFocus) {
    source.focus({ preventScroll: true });
    scrollSourceTarget(position.line);
    updateCursor({ scrollPreview: true });
    return;
  }
  const line = $(`[data-line="${position.line}"]`, page);
  if (!previewLineIsEditable(line)) return;
  revealPreviewEmptyRun(line, position.column === 0);
  page.focus({ preventScroll: true });
  placeCaretAtOffset(line, Math.min(position.column, line.textContent.length));
  scrollPreviewTarget(line);
  updateCursor();
}

function changeVimSource(value, offset, previewFocus) {
  source.value = value;
  source.setSelectionRange(offset, offset);
  sourceChanged();
  focusVimCursor(previewFocus, offset);
}

function syncVimPreviewPosition() {
  const line = previewLineForNode(getSelection()?.focusNode);
  const edit = previewSelection(line);
  if (line && edit) setSourceCursorFromPreview(line, edit.startOffset);
}

function vimPreviewTargetLine(currentLine, command) {
  const renderedLines = [...new Set($$(".script-line[data-line]", page)
    .filter((line) => previewLineIsEditable(line) && !line.classList.contains("empty"))
    .map((line) => Number(line.dataset.line))
    .filter(Number.isFinite))]
    .sort((left, right) => left - right);
  if (!renderedLines.length) return currentLine;
  if (command === "j") return renderedLines.find((line) => line > currentLine) ?? currentLine;
  return renderedLines.findLast((line) => line < currentLine) ?? currentLine;
}

function renderedTextOffsetRect(element, offset) {
  const length = element.textContent.replace(/\n$/, "").length;
  const column = Math.max(0, Math.min(offset, length));
  const point = previewTextPoint(element, column);
  const range = document.createRange(); range.setStart(point.node, point.offset); range.collapse(true);
  let rect = range.getClientRects()[0];
  if (!rect && length) {
    const adjacent = previewTextPoint(element, column < length ? column + 1 : column - 1);
    range.setStart(column < length ? point.node : adjacent.node, column < length ? point.offset : adjacent.offset);
    range.setEnd(column < length ? adjacent.node : point.node, column < length ? adjacent.offset : point.offset);
    const character = range.getClientRects()[0];
    if (character) rect = { top: character.top, left: column < length ? character.left : character.right };
  }
  return rect;
}

function wrappedRowTarget(points, currentColumn, command) {
  const current = points.find(({ column }) => column === currentColumn)
    || [...points].sort((left, right) => Math.abs(left.column - currentColumn) - Math.abs(right.column - currentColumn))[0];
  if (!current?.rect) return null;
  const tops = [...new Set(points.map(({ rect }) => Math.round(rect.top * 2) / 2))].sort((a, b) => a - b);
  const row = tops.findIndex((top) => Math.abs(top - current.rect.top) < 1);
  const targetRow = row + (command === "gj" ? 1 : -1);
  if (targetRow < 0 || targetRow >= tops.length) return null;
  const candidates = points.filter(({ rect }) => Math.abs(rect.top - tops[targetRow]) < 1);
  return candidates.sort((left, right) => Math.abs(left.rect.left - current.rect.left) - Math.abs(right.rect.left - current.rect.left))[0]?.column ?? null;
}

function sourceWrappedRowOffset(command, startOffset) {
  if (!document.body.classList.contains("source-wrap")) return null;
  const position = vimLinePosition(startOffset);
  const line = $(`[data-source-line="${position.line}"]`, $("#source-highlight"));
  if (!line) return null;
  const points = Array.from({ length: position.lines[position.line].length + 1 }, (_, column) => ({ column, rect: renderedTextOffsetRect(line, column) })).filter(({ rect }) => rect);
  const column = wrappedRowTarget(points, position.column, command);
  return column === null ? null : position.start + column;
}

function previewWrappedRowOffset(command, startOffset) {
  const position = vimLinePosition(startOffset);
  const line = $(`[data-line="${position.line}"]`, page);
  if (!line) return null;
  const original = position.lines[position.line];
  const points = Array.from({ length: line.textContent.length + 1 }, (_, displayColumn) => ({
    column: previewSourceOffset(line, original, displayColumn),
    rect: renderedTextOffsetRect(line, displayColumn),
  })).filter(({ rect }) => rect);
  const sourceColumn = wrappedRowTarget(points, position.column, command);
  return sourceColumn === null ? null : position.start + sourceColumn;
}

function moveVimDisplayLine(command, previewFocus, visual = false) {
  const start = visual ? state.vimVisualFocus : vimCursorOffset();
  const wrapped = previewFocus ? previewWrappedRowOffset(command, start) : sourceWrappedRowOffset(command, start);
  const offset = wrapped ?? moveVimCursor(command === "gj" ? "j" : "k", previewFocus, start);
  if (visual) focusVimSelection(previewFocus, state.vimVisualAnchor, offset);
  else focusVimCursor(previewFocus, offset);
}

function moveVimHalfPage(command, previewFocus, visual = false) {
  const lineHeight = parseFloat(getComputedStyle(previewFocus ? page : source).lineHeight) || 16;
  const viewportHeight = previewFocus ? $("#preview-scroll").clientHeight : source.clientHeight;
  const steps = Math.max(1, Math.floor(viewportHeight / lineHeight / 2));
  const down = command === "d";
  let offset = visual ? state.vimVisualFocus : vimCursorOffset();
  for (let step = 0; step < steps; step += 1) {
    const wrapped = previewFocus ? previewWrappedRowOffset(down ? "gj" : "gk", offset) : sourceWrappedRowOffset(down ? "gj" : "gk", offset);
    offset = wrapped ?? moveVimCursor(down ? "j" : "k", previewFocus, offset);
  }
  if (visual) focusVimSelection(previewFocus, state.vimVisualAnchor, offset);
  else focusVimCursor(previewFocus, offset);
}

function moveVimCursor(command, previewFocus = false, startOffset = vimCursorOffset()) {
  const position = vimLinePosition(startOffset);
  let offset = startOffset;
  if (command === "h") offset = Math.max(position.start, offset - 1);
  else if (command === "l") offset = Math.min(position.end, offset + 1);
  else if (command === "0" || command === "^") offset = position.start;
  else if (command === "$") offset = position.end;
  else if (command === "j" || command === "k") {
    const line = previewFocus
      ? vimPreviewTargetLine(position.line, command)
      : Math.max(0, Math.min(position.lines.length - 1, position.line + (command === "j" ? 1 : -1)));
    offset = sourceOffsetForLine(position.lines, line, Math.min(position.column, position.lines[line].length));
  } else if (command === "w") {
    const match = source.value.slice(offset + 1).match(/\b\w/);
    offset = match ? offset + 1 + match.index : source.value.length;
  } else if (command === "b") {
    const before = source.value.slice(0, Math.max(0, offset)).replace(/\W+$/, "");
    const match = [...before.matchAll(/\b\w/g)].at(-1);
    offset = match?.index ?? 0;
  } else if (command === "G") offset = source.value.length;
  return offset;
}

function handleVimKey(event, surface) {
  if (!vimActive()) return false;
  const previewFocus = surface === "preview";
  if (previewFocus) syncVimPreviewPosition();
  if (state.vimMode === "insert") {
    if (event.key === "Escape" || (event.ctrlKey && ["[", "c"].includes(event.key.toLowerCase()))) {
      event.preventDefault(); setVimMode("normal"); focusVimCursor(previewFocus);
      return true;
    }
    return false;
  }
  if (state.vimMode === "visual" && event.ctrlKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    const focus = state.vimVisualFocus;
    setVimMode("normal"); focusVimCursor(previewFocus, focus); return true;
  }
  if (event.ctrlKey && ["d", "u"].includes(event.key.toLowerCase())) {
    event.preventDefault();
    moveVimHalfPage(event.key.toLowerCase(), previewFocus, state.vimMode === "visual"); return true;
  }
  if ((event.metaKey || event.ctrlKey) && !(event.ctrlKey && event.key.toLowerCase() === "r")) return false;
  event.preventDefault();
  const key = event.key;
  if (state.vimMode === "visual") {
    if (["j", "k"].includes(key) && state.vimPending === "g") {
      state.vimPending = ""; moveVimDisplayLine(`g${key}`, previewFocus, true); return true;
    }
    if (key === "g") { state.vimPending = state.vimPending === "g" ? "" : "g"; return true; }
    if (["h", "j", "k", "l", "0", "^", "$", "w", "b", "G"].includes(key)) {
      const focus = moveVimCursor(key, previewFocus, state.vimVisualFocus);
      focusVimSelection(previewFocus, state.vimVisualAnchor, focus);
      return true;
    }
    if (key === "v" || key === "Escape") {
      const focus = state.vimVisualFocus;
      setVimMode("normal"); focusVimCursor(previewFocus, focus); return true;
    }
    if (["y", "d", "x"].includes(key)) {
      const visual = vimVisualRange();
      state.vimYank = source.value.slice(visual.start, visual.end); state.vimYankLine = false;
      const focus = visual.start;
      if (key === "d" || key === "x") changeVimSource(source.value.slice(0, visual.start) + source.value.slice(visual.end), focus, previewFocus);
      setVimMode("normal"); focusVimCursor(previewFocus, focus); return true;
    }
    return true;
  }
  const position = vimLinePosition();
  if (event.ctrlKey && key.toLowerCase() === "r") { redoDocument(); return true; }
  if (["j", "k"].includes(key) && state.vimPending === "g") {
    state.vimPending = ""; moveVimDisplayLine(`g${key}`, previewFocus); return true;
  }
  if (["h", "j", "k", "l", "0", "^", "$", "w", "b", "G"].includes(key)) {
    state.vimPending = "";
    focusVimCursor(previewFocus, moveVimCursor(key, previewFocus)); return true;
  }
  if (key === "g") {
    if (state.vimPending === "g") { state.vimPending = ""; focusVimCursor(previewFocus, 0); }
    else state.vimPending = "g";
    return true;
  }
  if (key === "v") {
    const anchor = vimCursorOffset();
    setVimMode("visual"); focusVimSelection(previewFocus, anchor, anchor); return true;
  }
  if (key === "i" || key === "a" || key === "I" || key === "A") {
    let offset = source.selectionStart;
    if (key === "a") offset = Math.min(position.end, offset + 1);
    else if (key === "I") offset = position.start;
    else if (key === "A") offset = position.end;
    focusVimCursor(previewFocus, offset); setVimMode("insert"); return true;
  }
  if (key === "o" || key === "O") {
    const insertAt = key === "o" ? position.end : position.start;
    const value = `${source.value.slice(0, insertAt)}\n${source.value.slice(insertAt)}`;
    changeVimSource(value, key === "o" ? insertAt + 1 : insertAt, previewFocus); setVimMode("insert"); return true;
  }
  if (key === "x" && source.selectionStart < position.end) {
    const offset = source.selectionStart;
    changeVimSource(source.value.slice(0, offset) + source.value.slice(offset + 1), offset, previewFocus); return true;
  }
  if (key === "d" || key === "y") {
    if (state.vimPending !== key) { state.vimPending = key; return true; }
    state.vimPending = "";
    state.vimYank = `${position.lines[position.line]}\n`; state.vimYankLine = true;
    if (key === "d") {
      position.lines.splice(position.line, 1);
      if (!position.lines.length) position.lines.push("");
      const line = Math.min(position.line, position.lines.length - 1);
      changeVimSource(position.lines.join("\n"), sourceOffsetForLine(position.lines, line, 0), previewFocus);
    }
    return true;
  }
  if (key === "p" && state.vimYank) {
    if (state.vimYankLine) {
      const pasted = state.vimYank.replace(/\n$/, "");
      position.lines.splice(position.line + 1, 0, pasted);
      const line = position.line + 1;
      changeVimSource(position.lines.join("\n"), sourceOffsetForLine(position.lines, line, 0), previewFocus);
    } else {
      const offset = Math.min(source.value.length, source.selectionStart + 1);
      changeVimSource(source.value.slice(0, offset) + state.vimYank + source.value.slice(offset), offset, previewFocus);
    }
    return true;
  }
  if (key === "u") { undoDocument(); return true; }
  if (key === "Escape") { setVimMode("normal"); return true; }
  state.vimPending = "";
  return true;
}

source.addEventListener("input", (event) => {
  sourceChanged();
  if (event.inputType === "insertText") showCompletions();
  else hideCompletions();
});
source.addEventListener("beforeinput", (event) => { if (vimActive() && state.vimMode === "normal") event.preventDefault(); });
source.addEventListener("scroll", () => { $("#line-numbers").scrollTop = source.scrollTop; syncSourceOverlay(); updateCursor(); scheduleWorkspaceCache(); });
const sourceResizeObserver = new ResizeObserver(() => requestAnimationFrame(renderEditorChrome));
sourceResizeObserver.observe(source);
document.fonts?.ready.then(() => renderEditorChrome());
source.addEventListener("click", () => { updateCursor({ scrollPreview: true }); hideCompletions(); scheduleWorkspaceCache(); });
source.addEventListener("select", () => { updateCursor({ scrollPreview: true }); scheduleWorkspaceCache(); });
source.addEventListener("keyup", (event) => { if (!["Enter", "Tab", "Escape"].includes(event.key)) updateCursor({ scrollPreview: true }); scheduleWorkspaceCache(); });
let sourceTouchMenuTimer = 0;
let sourceTouchStart = null;
function cancelSourceTouchMenu() {
  clearTimeout(sourceTouchMenuTimer);
  sourceTouchMenuTimer = 0;
  sourceTouchStart = null;
}
source.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  cancelSourceTouchMenu();
  sourceTouchStart = { x: event.clientX, y: event.clientY };
  sourceTouchMenuTimer = setTimeout(() => {
    sourceTouchMenuTimer = 0;
    showPreviewContextMenu(null, event.clientX + 12, event.clientY + 12, "source");
    navigator.vibrate?.(8);
  }, 420);
});
source.addEventListener("pointermove", (event) => {
  if (!sourceTouchStart || Math.hypot(event.clientX - sourceTouchStart.x, event.clientY - sourceTouchStart.y) <= 10) return;
  cancelSourceTouchMenu();
});
source.addEventListener("pointerup", cancelSourceTouchMenu);
source.addEventListener("pointercancel", cancelSourceTouchMenu);
source.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  hideCompletions();
  showPreviewContextMenu(null, event.clientX, event.clientY, "source");
});
source.addEventListener("keydown", (event) => {
  if (handleVimKey(event, "source")) return;
  if (!$("#completion-menu").hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); state.completionIndex = (state.completionIndex + (event.key === "ArrowDown" ? 1 : -1) + state.completionItems.length) % state.completionItems.length; renderCompletionMenu(); return; }
    if (event.key === "Tab") { event.preventDefault(); acceptCompletion(); return; }
    if (event.key === "Escape") { event.preventDefault(); hideCompletions(); return; }
  }
  if ((event.ctrlKey || event.metaKey) && event.code === "Space") { event.preventDefault(); showCompletions({ allowBlank: true }); }
  else if (event.key === "Tab") { event.preventDefault(); source.setRangeText("    ", source.selectionStart, source.selectionEnd, "end"); sourceChanged(); }
  else if (event.key === "Enter") hideCompletions();
});

page.addEventListener("beforeinput", (event) => {
  if (vimActive() && state.vimMode === "normal") { event.preventDefault(); return; }
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (!line) return;
  const edit = previewSelection(line); if (!edit) return;
  const insertionTypes = new Set(["insertText", "insertReplacementText", "insertFromPaste", "insertFromDrop", "insertParagraph", "insertLineBreak"]);
  const deletionTypes = new Set(["deleteContentBackward", "deleteContentForward", "deleteWordBackward", "deleteWordForward", "deleteSoftLineBackward", "deleteSoftLineForward", "deleteByCut", "deleteByDrag"]);
  if (!insertionTypes.has(event.inputType) && !deletionTypes.has(event.inputType)) return;
  event.preventDefault();
  hidePreviewCompletions();
  if (deletionTypes.has(event.inputType)) {
    const forward = event.inputType.includes("Forward");
    previewDeleteSelection(edit, forward ? "forward" : "backward", event.inputType.includes("Word"));
  } else {
    const text = event.inputType === "insertParagraph" || event.inputType === "insertLineBreak"
      ? "\n"
      : event.dataTransfer?.getData("text/plain") || event.data || "";
    replacePreviewSelection(edit, text);
  }
});
page.addEventListener("input", (event) => { const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (line) { syncPreviewLine(line); showPreviewCharacterCompletions(line); } });
page.addEventListener("paste", (event) => {
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (!line) return;
  const edit = previewSelection(line); if (!edit) return;
  event.preventDefault();
  replacePreviewSelection(edit, event.clipboardData?.getData("text/plain") || "");
});
page.addEventListener("keydown", (event) => {
  if (handleVimKey(event, "preview")) return;
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (!line) return;
  if (!$("#preview-completion-menu").hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); state.previewCompletionIndex = (state.previewCompletionIndex + (event.key === "ArrowDown" ? 1 : -1) + state.previewCompletionItems.length) % state.previewCompletionItems.length; renderPreviewCharacterCompletions(); return; }
    if (event.key === "Tab") { event.preventDefault(); acceptPreviewCharacterCompletion(); return; }
    if (event.key === "Escape") { event.preventDefault(); hidePreviewCompletions(); return; }
  }
  if (event.key === "Enter" && !event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const edit = previewSelection(line);
    if (!edit) return;
    event.preventDefault();
    hidePreviewCompletions();
    replacePreviewSelection(edit, "\n");
    return;
  }
  const verticalDirection = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  const atVerticalEdge = verticalDirection === -1
    ? previewCaretIsOnVisualEdge(line, "first")
    : verticalDirection === 1 && previewCaretIsOnVisualEdge(line, "last");
  if (verticalDirection && atVerticalEdge) {
    const edit = previewSelection(line);
    const adjacent = adjacentPreviewEditableLine(line, verticalDirection);
    if (edit && edit.startLine === edit.endLine && edit.startOffset === edit.endOffset && adjacent) {
      event.preventDefault();
      const offset = Math.min(edit.startOffset, adjacent.textContent.length);
      page.focus({ preventScroll: true });
      placeCaretAtOffset(adjacent, offset);
      setSourceCursorFromPreview(adjacent, offset);
    }
  }
});
page.addEventListener("focusin", () => { const line = previewLineForNode(getSelection()?.focusNode); if (line) setSourceCursorFromPreview(line); });
page.addEventListener("pointerup", (event) => { const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (!line?.classList.contains("preview-draft-row")) $$(".preview-draft-row", page).forEach((row) => row.remove()); const edit = previewSelection(line); if (edit) { setSourceSelectionFromPreview(edit); updatePreviewCursor(); } });
page.addEventListener("keyup", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); const edit = previewSelection(line); if (edit) setSourceSelectionFromPreview(edit);
});
page.addEventListener("focusout", () => setTimeout(() => {
  if (!page.contains(document.activeElement)) $$(".script-line.empty.preview-empty-context", page).forEach((line) => line.classList.remove("preview-empty-context"));
  if (!page.contains(document.activeElement)) $$(".preview-draft-row", page).forEach((row) => row.remove());
  if (!$("#preview-completion-menu").matches(":hover")) hidePreviewCompletions();
}, 0));
let previewTouchMenuTimer = 0;
let previewTouchStart = null;
let suppressPreviewClickUntil = 0;
function cancelPreviewTouchMenu() {
  clearTimeout(previewTouchMenuTimer);
  previewTouchMenuTimer = 0;
  previewTouchStart = null;
}
page.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" || event.target.closest(".annotation-orb")) return;
  const line = event.target.closest(".script-line");
  if (!line) return;
  cancelPreviewTouchMenu();
  previewTouchStart = { x: event.clientX, y: event.clientY };
  previewTouchMenuTimer = setTimeout(() => {
    previewTouchMenuTimer = 0;
    if (!line.isConnected) return;
    suppressPreviewClickUntil = Date.now() + 900;
    hidePreviewCompletions();
    placePreviewCaretFromPoint(line, event.clientX, event.clientY);
    showPreviewContextMenu(line, event.clientX + 12, event.clientY + 12);
    navigator.vibrate?.(8);
  }, 420);
});
page.addEventListener("pointermove", (event) => {
  if (!previewTouchStart || Math.hypot(event.clientX - previewTouchStart.x, event.clientY - previewTouchStart.y) <= 10) return;
  cancelPreviewTouchMenu();
});
page.addEventListener("pointerup", cancelPreviewTouchMenu);
page.addEventListener("pointercancel", cancelPreviewTouchMenu);
page.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (Date.now() < suppressPreviewClickUntil) return;
  const line = event.target.closest(".script-line");
  if (!line || event.target.closest(".annotation-orb")) return;
  hidePreviewCompletions();
  const selection = previewSelectionInPage();
  if (!selection || selection.isCollapsed) placePreviewCaretFromPoint(line, event.clientX, event.clientY);
  showPreviewContextMenu(line, event.clientX, event.clientY);
});
page.addEventListener("click", (event) => {
  if (Date.now() < suppressPreviewClickUntil) { event.preventDefault(); return; }
  hidePreviewContextMenu();
  const orb = event.target.closest(".annotation-orb");
  if (orb) { event.preventDefault(); openAnnotationEditor(Number(orb.dataset.annotationLine)); }
});
$("#preview-context-menu").addEventListener("click", async (event) => {
  const suggestionButton = event.target.closest("[data-spelling-suggestion]");
  if (suggestionButton) {
    const candidate = state.contextWord;
    const surface = state.contextSurface;
    if (!candidate) return;
    source.setRangeText(suggestionButton.dataset.spellingSuggestion, candidate.start, candidate.end, "end");
    sourceChanged();
    hidePreviewContextMenu();
    if (surface === "preview") renderPreview({ focusLine: sourceLineAtOffset(candidate.start) });
    else source.focus();
    return;
  }
  const button = event.target.closest("[data-context-action]");
  if (!button) return;
  const { previewContextLine, previewContextEdit: edit, previewContextText: text, contextSelection, contextSurface } = state;
  const action = button.dataset.contextAction;
  hidePreviewContextMenu();
  if (action === "annotation") return openAnnotationEditor(null, previewContextLine);
  if (action === "undo") { undoDocument(); return; }
  if (action === "redo") { redoDocument(); return; }
  const message = contextSurface === "source"
    ? await runSourceContextAction(action, contextSelection)
    : await runPreviewClipboardAction(action, previewContextLine, { edit, text });
  if (message) toast(message);
});
$("#preview-completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptPreviewCharacterCompletion(Number(item.dataset.index)); } });
$("#completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptCompletion(Number(item.dataset.index)); } });
$("[data-character-analytics]").addEventListener("click", openCharacterAnalytics);
$("#close-character-analytics").addEventListener("click", () => $("#character-analytics-dialog").close());
$("#character-analytics-back").addEventListener("click", () => { state.characterAnalyticsScene = null; renderCharacterAnalytics(); });
$("#character-analytics-chart").addEventListener("click", (event) => {
  if (state.characterAnalyticsScene !== null) return;
  const scenes = state.metadata.scenes || [];
  if (!scenes.length) return;
  const canvas = event.currentTarget;
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * (parseFloat(canvas.style.width) / bounds.width);
  const y = (event.clientY - bounds.top) * (parseFloat(canvas.style.height) / bounds.height);
  if (y < 28 || y > 82 || x < 150) return;
  const sceneIndex = Math.floor((x - 150) / 92);
  if (sceneIndex < 0 || sceneIndex >= scenes.length) return;
  state.characterAnalyticsScene = sceneIndex;
  renderCharacterAnalytics();
});
$("#copy-character-lines").addEventListener("click", copyCharacterLineUsage);
$("#save-character-analytics").addEventListener("click", saveCharacterAnalyticsPng);
$("#scene-list").addEventListener("click", (event) => { const button = event.target.closest("button[data-line]"); if (button) jumpToInsightScene(Number(button.dataset.line)); });
$("#character-line-table").addEventListener("click", (event) => {
  const button = event.target.closest("[data-character-note]");
  if (button) openCharacterNoteEditor(button.dataset.characterNote);
});
$("#general-notes").addEventListener("click", (event) => {
  const button = event.target.closest("[data-general-note-line]");
  if (button) openGeneralNoteEditor(Number(button.dataset.generalNoteLine));
});
$("#add-general-note").addEventListener("click", () => openGeneralNoteEditor());
$("#menu-toggle-beat-guide").addEventListener("click", () => {
  state.beatGuide = !state.beatGuide;
  localStorage.setItem("fountain-publisher.beat-guide", String(state.beatGuide));
  if (state.beatGuide && isMobilePreview()) setMobileTab("preview");
  renderBeatGuide(); closeMenus();
});
$("#beat-guide-layer").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-beat-guide]")) {
    state.beatGuide = false; localStorage.setItem("fountain-publisher.beat-guide", "false"); renderBeatGuide(); return;
  }
  if (event.target.closest("[data-open-beat-sheet]")) { openBeatSheet(); return; }
  if (event.target.closest("[data-assign-beat-area]")) { assignCurrentBeatArea(); return; }
  if (event.target.closest("[data-previous-beat]")) {
    state.activeBeat = Math.max(0, state.activeBeat - 1); renderBeatGuide(); jumpToBeatArea(state.metadata.beatSheet?.beats[state.activeBeat]); return;
  }
  if (event.target.closest("[data-next-beat]")) {
    state.activeBeat = Math.min((state.metadata.beatSheet?.beats.length || 1) - 1, state.activeBeat + 1); renderBeatGuide(); jumpToBeatArea(state.metadata.beatSheet?.beats[state.activeBeat]); return;
  }
});
$("#add-beat").addEventListener("click", () => {
  const selected = $("#beat-list .beat-card.selected");
  if (selected) selected.insertAdjacentHTML("afterend", beatCard());
  else $("#beat-list").insertAdjacentHTML("beforeend", beatCard());
  const added = selected ? selected.nextElementSibling : $("#beat-list .beat-card:last-child");
  renumberBeatCards();
  $(".beat-text", added).focus();
});
$("#view-beat-progress").addEventListener("click", openBeatProgressGraph);
$("#export-beat-sheet").addEventListener("click", exportBeatSheetPdf);
$("#close-beat-progress").addEventListener("click", () => $("#beat-progress-dialog").close());
$("#save-beat-progress").addEventListener("click", saveBeatProgressPng);
$("#beat-list").addEventListener("click", (event) => {
  const card = event.target.closest(".beat-card");
  if (!card) return;
  $$(".beat-card.selected", $("#beat-list")).forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
  if (event.target.closest(".beat-up") && card.previousElementSibling) card.parentElement.insertBefore(card, card.previousElementSibling);
  else if (event.target.closest(".beat-down") && card.nextElementSibling) card.parentElement.insertBefore(card.nextElementSibling, card);
  else if (event.target.closest(".beat-remove")) card.remove();
  else if (event.target.closest(".beat-unassign")) {
    const beat = currentBeatCards()[$$(".beat-card", $("#beat-list")).indexOf(card)];
    card.outerHTML = beatCard({ ...beat, range: null });
    renumberBeatCards();
    persistBeatSheet();
    return;
  }
  else if (event.target.closest("[data-beat-jump]")) {
    const beat = currentBeatCards()[$$(".beat-card", $("#beat-list")).indexOf(card)];
    persistBeatSheet();
    void setPreviewMode("live").then(() => requestAnimationFrame(() => jumpToBeatArea(beat)));
    return;
  }
  else return;
  renumberBeatCards();
  scheduleBeatSheetSave();
});
$("#beat-list").addEventListener("focusin", (event) => {
  const card = event.target.closest(".beat-card");
  if (!card) return;
  $$(".beat-card.selected", $("#beat-list")).forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
});
let pointerDraggedBeat = null;
let beatDragPointerId = null;
$("#beat-list").addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".beat-drag");
  if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
  pointerDraggedBeat = handle.closest(".beat-card");
  beatDragPointerId = event.pointerId;
  handle.setPointerCapture?.(event.pointerId);
  pointerDraggedBeat?.classList.add("dragging", "touch-dragging");
  event.preventDefault();
});
$("#beat-list").addEventListener("pointermove", (event) => {
  if (!pointerDraggedBeat || event.pointerId !== beatDragPointerId) return;
  event.preventDefault();
  const siblings = $$(".beat-card", $("#beat-list")).filter((card) => card !== pointerDraggedBeat);
  const before = siblings.find((card) => event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2);
  $("#beat-list").insertBefore(pointerDraggedBeat, before || null);
  const scrollArea = $(".beat-sheet-workspace");
  const bounds = scrollArea.getBoundingClientRect();
  if (event.clientY < bounds.top + 48) scrollArea.scrollTop -= 14;
  else if (event.clientY > bounds.bottom - 48) scrollArea.scrollTop += 14;
});
function finishPointerBeatDrag(event) {
  if (!pointerDraggedBeat || event.pointerId !== beatDragPointerId) return;
  pointerDraggedBeat.classList.remove("dragging", "touch-dragging");
  pointerDraggedBeat = null;
  beatDragPointerId = null;
  renumberBeatCards();
  scheduleBeatSheetSave();
}
$("#beat-list").addEventListener("pointerup", finishPointerBeatDrag);
$("#beat-list").addEventListener("pointercancel", finishPointerBeatDrag);
$("#beat-list").addEventListener("keydown", (event) => {
  const handle = event.target.closest(".beat-drag");
  if (handle && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const card = handle.closest(".beat-card");
    if (event.key === "ArrowUp" && card.previousElementSibling) card.parentElement.insertBefore(card, card.previousElementSibling);
    else if (event.key === "ArrowDown" && card.nextElementSibling) card.parentElement.insertBefore(card.nextElementSibling, card);
    else if (event.key === "Home") card.parentElement.prepend(card);
    else if (event.key === "End") card.parentElement.append(card);
    renumberBeatCards();
    scheduleBeatSheetSave();
    handle.focus();
    return;
  }
  if (event.key !== "Enter" || !event.target.matches(".beat-text")) return;
  event.preventDefault();
  const card = event.target.closest(".beat-card");
  let next = card.nextElementSibling;
  if (!next) {
    $("#beat-list").insertAdjacentHTML("beforeend", beatCard());
    next = $("#beat-list .beat-card:last-child");
    renumberBeatCards();
  }
  scheduleBeatSheetSave();
  $(".beat-text", next).focus();
});
let beatSheetSaveTimer = 0;
function persistBeatSheet() {
  const premise = $("#beat-premise").value.trim();
  const beats = currentBeatCards().filter((beat) => beat.text);
  const existingLine = state.metadata.beatSheet?.line;
  if (!premise && !beats.length) deleteNoteLine(existingLine);
  else {
    const value = managedBeatSheetSource(premise, beats);
    if (existingLine === null || existingLine === undefined) appendManagedNote(value);
    else { const lines = sourceLines(); lines[existingLine] = value; setSourceLines(lines); }
  }
}
function scheduleBeatSheetSave() {
  clearTimeout(beatSheetSaveTimer);
  beatSheetSaveTimer = setTimeout(persistBeatSheet, 300);
}
$("#beat-sheet-form").addEventListener("submit", (event) => event.preventDefault());
$("#beat-sheet-form").addEventListener("input", () => { renderBeatProgressGraph(); scheduleBeatSheetSave(); });
$("#beat-sheet-form").addEventListener("change", scheduleBeatSheetSave);

$("#annotation-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const text = $("#annotation-text").value.trim().replace(/\s*\n+\s*/g, " ").replaceAll("]]", "] ]");
  if (!text) return;
  const lines = sourceLines();
  if (state.noteEditor.line === null) {
    const insertAt = state.noteEditor.insertAfter + 1;
    const nextType = classifyLines(source.value)[insertAt]?.type;
    lines.splice(insertAt, 0, `[[${text}]]`);
    if (nextType === "character" && lines[insertAt + 1]?.trim()) lines.splice(insertAt + 1, 0, "");
  }
  else lines[state.noteEditor.line] = `[[${text}]]`;
  setSourceLines(lines);
  $("#annotation-dialog").close();
});
$("#delete-annotation").addEventListener("click", () => {
  deleteNoteLine(state.noteEditor?.line);
  $("#annotation-dialog").close();
});

$("#character-note-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const text = $("#character-note-text").value.trim();
  if (!text) { deleteNoteLine(state.noteEditor.line); $("#character-note-dialog").close(); return; }
  const value = managedCharacterSource(state.noteEditor.name, text);
  if (state.noteEditor.line === null) appendManagedNote(value);
  else { const lines = sourceLines(); lines[state.noteEditor.line] = value; setSourceLines(lines); }
  $("#character-note-dialog").close();
});
$("#delete-character-note").addEventListener("click", () => {
  deleteNoteLine(state.noteEditor?.line);
  $("#character-note-dialog").close();
});

$("#general-note-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const text = $("#general-note-text").value.trim();
  if (!text) return;
  const value = managedGeneralSource(text);
  if (state.noteEditor.line === null) appendManagedNote(value);
  else { const lines = sourceLines(); lines[state.noteEditor.line] = value; setSourceLines(lines); }
  $("#general-note-dialog").close();
});
$("#delete-general-note").addEventListener("click", () => {
  deleteNoteLine(state.noteEditor?.line);
  $("#general-note-dialog").close();
});

$("#new-file").addEventListener("click", newFile); $("#open-file").addEventListener("click", openFile); $("#save-file").addEventListener("click", () => saveFile(false)); $("#save-file-as").addEventListener("click", () => saveFile(true));
$("#github-connect").addEventListener("click", connectGithub);
$("#github-open").addEventListener("click", () => openGithubBrowser("open"));
$("#github-save").addEventListener("click", () => openGithubBrowser("save"));
$("#close-github-dialog").addEventListener("click", () => $("#github-dialog").close());
$("#github-install").addEventListener("click", () => { if (state.githubInstallUrl) openGithubPopup(state.githubInstallUrl); });
$("#github-disconnect").addEventListener("click", async () => {
  try { await githubRequest("/auth/logout", { method: "POST" }); } catch { /* the local disconnected state still applies */ }
  state.githubConnected = false; state.githubFile = null;
  state.githubRepository = ""; state.githubBranch = ""; state.githubPath = "";
  localStorage.removeItem(GITHUB_BROWSER_KEY);
  if (clearWorkspaceOnExit()) clearWorkspaceCache();
  updateGithubMenu(); $("#github-dialog").close(); toast("Disconnected from GitHub");
});
$("#github-repository").addEventListener("input", () => {
  clearTimeout(state.githubRepositoryTimer);
  state.githubFilesRevision += 1;
  $("#github-save-here").disabled = true;
  if (!selectedGithubRepository()) {
    $("#github-branch").value = "";
    state.githubBranches = [];
    $("#github-branches").innerHTML = "";
    $("#github-files").innerHTML = `<div class="github-column"><div class="github-empty">Choose a repository suggestion.</div></div>`;
    return;
  }
  $("#github-files").innerHTML = `<div class="github-column"><div class="github-empty">Loading repository…</div></div>`;
  state.githubRepositoryTimer = setTimeout(() => loadGithubBranches().catch((error) => toast(error.message)), 250);
});
$("#github-branch").addEventListener("input", () => {
  clearTimeout(state.githubRepositoryTimer);
  state.githubFilesRevision += 1;
  $("#github-save-here").disabled = true;
  if (!state.githubBranches.includes($("#github-branch").value)) {
    $("#github-files").innerHTML = `<div class="github-column"><div class="github-empty">Choose a branch suggestion.</div></div>`;
    return;
  }
  state.githubRepositoryTimer = setTimeout(() => loadGithubFiles("").catch((error) => toast(error.message)), 250);
});
$("#github-breadcrumbs").addEventListener("click", (event) => { const button = event.target.closest("[data-github-path]"); if (button) loadGithubFiles(button.dataset.githubPath); });
$("#github-files").addEventListener("click", (event) => {
  const entry = event.target.closest("[data-github-entry]");
  if (!entry) return;
  if (entry.dataset.githubType === "dir") loadGithubFiles(entry.dataset.githubEntry);
  else if (state.githubBrowserMode === "save") {
    $("#github-filename").value = entry.dataset.githubEntry.split("/").pop();
    $("#github-save-details").open = true;
    $("#github-save-status").textContent = "Filename selected. Choose Save here to commit.";
  } else openGithubFile(entry.dataset.githubEntry, entry);
});
$("#github-save-here").addEventListener("click", saveGithubFile);
window.addEventListener("message", async (event) => {
  if (event.origin !== GITHUB_API || !["github-connected", "github-installed", "github-error"].includes(event.data?.type)) return;
  if (event.data.type === "github-error") return toast(event.data.message || "GitHub connection failed");
  if (await refreshGithubSession({ notify: true })) await openGithubBrowser();
});
$("#file-input").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) { state.handle = null; setDocument(await file.text(), file.name, true); } event.target.value = ""; });
$("#export-pdf").addEventListener("click", () => openExport("pdf")); $("#export-fdx").addEventListener("click", () => openExport("fdx"));
$("#export-format").addEventListener("change", (event) => { $("#dialog-page-size").hidden = event.target.value !== "pdf"; });
$("#export-form").addEventListener("submit", (event) => { if (event.submitter?.value !== "default") return; event.preventDefault(); exportDocument($("#export-format").value); });
$("#theme").addEventListener("click", cycleTheme); $("#spellcheck").addEventListener("change", () => {
  const enabled = $("#spellcheck").checked;
  source.spellcheck = enabled;
  source.setAttribute("spellcheck", String(enabled));
  $("#spellcheck-help").hidden = !enabled;
  renderPreview();
  // Refocusing prompts Chromium/WebKit to rerun the native checker immediately.
  if (enabled) { const start = source.selectionStart; const end = source.selectionEnd; source.blur(); source.focus(); source.setSelectionRange(start, end); }
});
$("#word-wrap").addEventListener("change", () => {
  const enabled = $("#word-wrap").checked;
  localStorage.setItem("fountain-publisher.word-wrap", String(enabled));
  document.body.classList.toggle("source-wrap", enabled);
  source.setAttribute("wrap", enabled ? "soft" : "off");
  renderEditorChrome();
});
$("#vim-mode").addEventListener("change", (event) => {
  state.vimEnabled = event.target.checked;
  localStorage.setItem("fountain-publisher.vim-mode", String(state.vimEnabled));
  setVimMode("normal");
});
$("#clear-workspace-on-exit").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.clear-workspace-on-exit", String(event.target.checked));
  if (event.target.checked) clearWorkspaceCache();
  else scheduleWorkspaceCache();
});
$("#open-background-dialog").addEventListener("click", () => {
  if (isMobilePreview()) {
    requestAnimationFrame(() => {
      setMobileMenu(false);
      $("#background-dialog").showModal();
    });
  } else $("#background-dialog").showModal();
});
$("#preview-background").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.preview-background", event.target.value);
  applyPreviewBackground();
});
$("#preview-dot-radius").addEventListener("input", (event) => {
  localStorage.setItem("fountain-publisher.preview-dot-radius", event.target.value);
  applyPreviewBackground();
});
$("#preview-dot-direction").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.preview-dot-direction", event.target.value);
  applyPreviewBackground();
});
$("#preview-dot-speed").addEventListener("input", (event) => {
  localStorage.setItem("fountain-publisher.preview-dot-speed", event.target.value);
  applyPreviewBackground();
});
$("#preview-star-density").addEventListener("input", (event) => {
  localStorage.setItem("fountain-publisher.preview-star-density", event.target.value);
  applyPreviewBackground();
});
$("#preview-star-colors").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.preview-star-colors", String(event.target.checked));
  applyPreviewBackground();
});
$("#page-size").addEventListener("change", () => { scheduleCompile(0); if (state.previewMode === "pdf") refreshPdf(); });
$$('[data-preview-mode]').forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.previewMode;
  if (isMobilePreview()) setMobileTab(mode === "beats" ? "beats" : mode === "source" ? "source" : "preview");
  else setPreviewMode(mode);
}));
$$('[data-toggle-stats]').forEach((button) => button.addEventListener("click", () => togglePanel("stats")));
$("#menu-toggle-stats").addEventListener("click", () => isMobilePreview() ? setMobileTab("stats") : togglePanel("stats"));
$("#menu-toggle-source-tab").addEventListener("click", () => {
  if (isMobilePreview()) {
    const opening = state.previewMode !== "source";
    localStorage.setItem("fountain-publisher.source-tab", String(opening));
    document.body.classList.toggle("source-tab-hidden", !opening);
    $(".menu-check", $("#menu-toggle-source-tab")).textContent = opening ? "✓" : "";
    setMobileTab(opening ? "source" : "preview");
    closeMenus();
    return;
  }
  const enabled = !sourceTabEnabled();
  localStorage.setItem("fountain-publisher.source-tab", String(enabled));
  document.body.classList.toggle("source-tab-hidden", !enabled);
  $(".menu-check", $("#menu-toggle-source-tab")).textContent = enabled ? "✓" : "";
  if (!enabled && state.previewMode === "source") {
    void setPreviewMode("live");
  }
  closeMenus();
});
$("#toggle-fullscreen").addEventListener("click", () => { void toggleFullscreen(); });
$("#install-app").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  updateAppWindowControls();
});
$("#undo").addEventListener("click", undoDocument); $("#redo").addEventListener("click", redoDocument);
$$('[data-workspace-zoom]').forEach((control) => control.addEventListener("change", () => { state.previewZoom = control.value; applyZoom(); }));
$$('[data-zoom-out]').forEach((button) => button.addEventListener("click", () => stepZoom(-1)));
$$('[data-zoom-in]').forEach((button) => button.addEventListener("click", () => stepZoom(1)));
$$('[data-zoom-fit]').forEach((button) => button.addEventListener("click", () => { state.previewZoom = "fit"; applyZoom(); }));
$("#open-docs").addEventListener("click", () => $("#docs-dialog").showModal());
$("#close-docs").addEventListener("click", () => $("#docs-dialog").close());

function insertAtDocumentStart(text) {
  const current = source.value;
  source.value = text + (current ? "\n" + current : "");
  sourceChanged(); source.setSelectionRange(0, 0); source.scrollTop = 0; source.focus();
}
function appendToSource(text) {
  const current = source.value;
  const sep = !current ? "" : current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  source.value = current + sep + text;
  sourceChanged(); source.focus();
}

function parseTitleBlock(text) {
  const fields = {};
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let fieldSeen = false;
  let lastKey = null;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { if (fieldSeen) break; continue; }
    const match = raw.match(/^([A-Za-z][A-Za-z ]+):(.*)/);
    if (match && TITLE_KEYS.has(match[1].trim().toLowerCase())) {
      lastKey = match[1].trim().toLowerCase();
      fields[lastKey] = match[2].trim();
      fieldSeen = true;
    } else if (fieldSeen && lastKey && /^\s+/.test(raw)) {
      fields[lastKey] = (fields[lastKey] ? fields[lastKey] + " " : "") + trimmed;
    } else {
      break;
    }
  }
  return fields;
}

function titleBlockLineCount(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let fieldSeen = false;
  let count = 0;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { if (fieldSeen) { count += 1; break; } count += 1; continue; }
    const match = raw.match(/^([A-Za-z][A-Za-z ]+):(.*)/);
    if ((match && TITLE_KEYS.has(match[1].trim().toLowerCase())) || (fieldSeen && /^\s+/.test(raw))) {
      fieldSeen = true; count += 1;
    } else { break; }
  }
  return count;
}

$("#title-page-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const rows = [];
  const tp = (id, key) => { const v = $(`#${id}`).value.trim(); if (v) rows.push(`${key}: ${v}`); };
  tp("tp-title", "Title"); tp("tp-credit", "Credit"); tp("tp-author", "Author"); tp("tp-date", "Draft date"); tp("tp-contact", "Contact");
  if (rows.length) {
    const newBlock = rows.join("\n") + "\n";
    if (state.metadata.titleFields.length > 0) {
      const current = source.value;
      const removeLines = titleBlockLineCount(current);
      const remainder = current.replace(/\r\n?/g, "\n").split("\n").slice(removeLines).join("\n");
      source.value = newBlock + (remainder ? "\n" + remainder : "");
      sourceChanged(); source.setSelectionRange(0, 0); source.scrollTop = 0; source.focus();
    } else {
      insertAtDocumentStart(newBlock);
    }
  }
  $("#title-page-dialog").close();
});

function openTitlePageDialog() {
  const hasTitlePage = state.metadata.titleFields.length > 0;
  const label = hasTitlePage ? "Edit title page" : "Add title page";
  $("#tp-heading").textContent = label;
  $("#title-page-dialog").querySelector("button.primary").textContent = label;
  if (hasTitlePage) {
    const existing = parseTitleBlock(source.value);
    const get = (key) => existing[key] ?? "";
    $("#tp-title").value = get("title");
    $("#tp-credit").value = get("credit");
    $("#tp-author").value = get("author") || get("authors");
    $("#tp-date").value = get("draft date") || get("date");
    $("#tp-contact").value = get("contact");
  } else {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    $("#tp-title").value = ""; $("#tp-credit").value = "Written by"; $("#tp-author").value = ""; $("#tp-date").value = today; $("#tp-contact").value = "";
  }
  $("#title-page-dialog").showModal(); setTimeout(() => $("#tp-title").focus(), 0);
}
$("#insert-title-page").addEventListener("click", openTitlePageDialog);
$("#insert-scene").addEventListener("click", () => { appendToSource("INT. LOCATION - DAY\n\n"); });
$("#insert-dialogue").addEventListener("click", () => { appendToSource("CHARACTER\nDialogue here.\n\n"); });
$("#insert-direction").addEventListener("click", () => { appendToSource("Action description.\n\n"); });
$("#insert-pagebreak").addEventListener("click", () => { appendToSource("===\n\n"); });
$("#menu-insert-title-page").addEventListener("click", openTitlePageDialog);
$("#menu-insert-scene").addEventListener("click", () => { appendToSource("INT. LOCATION - DAY\n\n"); });
$("#menu-insert-dialogue").addEventListener("click", () => { appendToSource("CHARACTER\nDialogue here.\n\n"); });
$("#menu-insert-direction").addEventListener("click", () => { appendToSource("Action description.\n\n"); });
$("#menu-insert-transition").addEventListener("click", () => { appendToSource("CUT TO:\n\n"); });
$("#menu-insert-section").addEventListener("click", () => { appendToSource("# Act 1\n\n"); });
$("#menu-insert-pagebreak").addEventListener("click", () => { appendToSource("===\n\n"); });
$("#menu-insert-centered").addEventListener("click", () => { appendToSource("> Centered text <\n\n"); });

function applySceneNumSettings() {
  document.body.classList.remove("scene-nums-margin", "scene-nums-inline", "scene-nums-off");
  document.body.classList.add(`scene-nums-${docSettings.sceneNumbers}`);
  renderPreview(); scheduleCompile(0); if (state.previewMode === "pdf") refreshPdf();
}
$("#menu-scene-numbers").addEventListener("click", () => {
  $("#scene-num-placement").value = docSettings.sceneNumbers;
  $("#scene-num-format").value = docSettings.sceneNumberFormat;
  $("#scene-num-dialog").showModal();
});
$("#scene-num-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  setDocSetting("sceneNumbers", $("#scene-num-placement").value);
  setDocSetting("sceneNumberFormat", $("#scene-num-format").value);
  applySceneNumSettings();
  $("#scene-num-dialog").close();
});

function setMobileTab(panel) {
  document.body.dataset.mobileTab = panel;
  $$(".mobile-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mobilePanel === panel));
  localStorage.setItem("fountain-publisher.mobile-tab", panel);
  if (panel === "source" && isMobilePreview()) void setPreviewMode("source");
  else if (panel === "preview" && isMobilePreview() && state.previewMode !== "live") void setPreviewMode("live");
  else if (panel === "beats" && isMobilePreview() && state.previewMode !== "beats") void setPreviewMode("beats");
  else if (panel === "preview" && state.previewMode === "pdf") refreshPdf();
  if (panel === "source") { renderEditorChrome(); scrollSourceTarget(currentPosition().line, "center"); }
  if (panel !== "stats" && state.insightLine !== null) requestAnimationFrame(() => jumpToLine(state.insightLine, false));
}

$$(".mobile-tab").forEach((tab) => tab.addEventListener("click", () => setMobileTab(tab.dataset.mobilePanel)));
$("#preview-scroll").addEventListener("scroll", () => { hidePreviewContextMenu(); scheduleWorkspaceCache(); });
$("#mobile-menu-toggle").addEventListener("click", () => setMobileMenu(!document.body.classList.contains("mobile-menu-open")));
$("#mobile-menu-backdrop").addEventListener("click", () => setMobileMenu(false));

toolbarMenus.forEach((menu) => menu.addEventListener("click", (event) => {
  if (event.target.closest("button, a")) {
    // Let the tapped control finish dispatching before hiding its details/drawer.
    // Closing synchronously can cancel the action in mobile WebKit.
    requestAnimationFrame(() => {
      menu.open = false;
      if (isMobilePreview()) setMobileMenu(false);
    });
  }
}));
toolbarMenus.forEach((menu) => menu.addEventListener("toggle", () => {
  if (menu.open) closeMenus(menu);
}));
document.addEventListener("pointerdown", (event) => toolbarMenus.forEach((menu) => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
}));
document.addEventListener("pointerdown", (event) => {
  const menu = $("#preview-context-menu");
  if (!menu.hidden && !menu.contains(event.target)) hidePreviewContextMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#preview-context-menu").hidden) hidePreviewContextMenu();
  else if (event.key === "Escape" && document.body.classList.contains("mobile-menu-open")) setMobileMenu(false);
  else if (event.key === "Escape" && toolbarMenus.some((menu) => menu.open)) { closeMenus(); }
  else if ((source === document.activeElement || page.contains(document.activeElement)) && (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redoDocument() : undoDocument(); }
  else if ((source === document.activeElement || page.contains(document.activeElement)) && event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "y") { event.preventDefault(); redoDocument(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveFile(event.shiftKey); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") { event.preventDefault(); openFile(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); newFile(); }
});
window.addEventListener("beforeunload", () => {
  if (clearWorkspaceOnExit()) clearWorkspaceCache();
  else persistWorkspaceNow();
});

let mobileViewportFrame = 0;
function updateMobileViewport() {
  mobileViewportFrame = 0;
  const viewport = window.visualViewport;
  const root = document.documentElement;
  root.style.setProperty("--visual-viewport-top", `${viewport?.offsetTop || 0}px`);
  root.style.setProperty("--visual-viewport-left", `${viewport?.offsetLeft || 0}px`);
  root.style.setProperty("--visual-viewport-width", `${viewport?.width || window.innerWidth}px`);
  root.style.setProperty("--visual-viewport-height", `${viewport?.height || window.innerHeight}px`);
}
function scheduleMobileViewportUpdate() {
  if (!mobileViewportFrame) mobileViewportFrame = requestAnimationFrame(updateMobileViewport);
}

window.visualViewport?.addEventListener("resize", scheduleMobileViewportUpdate);
window.visualViewport?.addEventListener("scroll", scheduleMobileViewportUpdate);
window.addEventListener("scroll", scheduleMobileViewportUpdate);
document.addEventListener("focusin", scheduleMobileViewportUpdate);
window.addEventListener("resize", () => {
  scheduleMobileViewportUpdate();
  hidePreviewContextMenu();
  renderEditorChrome();
  if (isMobilePreview() && state.previewMode === "pdf") void setPreviewMode("live");
  applyPreviewBackground();
  applyZoom();
  updateVimUi();
  if ($("#character-analytics-dialog").open) renderCharacterAnalytics();
});

function registerAppServiceWorker() {
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  if (!("serviceWorker" in navigator) || location.protocol !== "https:" || localHost) return;
  navigator.serviceWorker.register("./service-worker.js").catch(() => { /* Online use remains available if registration is blocked. */ });
}

async function initialize() {
  updateMobileViewport();
  setTheme(state.theme);
  updateAppWindowControls();
  registerAppServiceWorker();
  const showSourceTab = sourceTabEnabled();
  document.body.classList.toggle("source-tab-hidden", !showSourceTab);
  $(".menu-check", $("#menu-toggle-source-tab")).textContent = showSourceTab ? "✓" : "";
  applyPreviewBackground();
  const isMac = /Mac/i.test(navigator.platform) || /Mac/i.test(navigator.userAgentData?.platform || "");
  document.documentElement.dataset.os = isMac ? "mac" : "win";
  const wordWrap = localStorage.getItem("fountain-publisher.word-wrap") !== "false";
  $("#word-wrap").checked = wordWrap; document.body.classList.toggle("source-wrap", wordWrap); source.setAttribute("wrap", wordWrap ? "soft" : "off");
  $("#vim-mode").checked = state.vimEnabled;
  updateVimUi();
  $("#clear-workspace-on-exit").checked = clearWorkspaceOnExit();
  document.body.classList.add(`scene-nums-${docSettings.sceneNumbers}`);
  const statsWidth = Number(localStorage.getItem("fountain-publisher.--stats-w"));
  if (statsWidth) document.documentElement.style.setProperty("--stats-w", `${statsWidth}px`);
  const storedStatsCollapsed = localStorage.getItem("fountain-publisher.stats-collapsed");
  togglePanel("stats", storedStatsCollapsed === null || storedStatsCollapsed === "true");
  installResizer($("#stats-resizer"), "--stats-w", -1, 240, 520);
  const params = new URLSearchParams(location.search);
  const cached = params.get("demo") === "1" ? null : readWorkspaceCache();
  let text = params.get("demo") === "1" ? SAMPLE : BLANK_TEMPLATE;
  let name = params.get("demo") === "1" ? "The Last Light.fountain" : "Untitled.fountain";
  if (params.has("project")) {
    try { const response = await fetch("/api/project"); const project = await response.json(); text = project.source; name = project.filename; } catch { /* keep selected blank/demo document */ }
  }
  const restore = cached && (!params.has("project") || cached.filename === name);
  if (restore) { text = cached.source; name = cached.filename || name; state.savedSource = typeof cached.savedSource === "string" ? cached.savedSource : text; }
  const enableWorkspaceCache = params.get("demo") !== "1";
  setDocument(text, name, !restore, restore ? cached.githubFile || null : null);
  void refreshGithubSession();
  const storedMobileTab = localStorage.getItem("fountain-publisher.mobile-tab") || "preview";
  const initialMobileTab = !showSourceTab && storedMobileTab === "source" ? "preview" : storedMobileTab;
  setMobileTab(initialMobileTab);
  if (restore && ["fit", "70", "85", "100", "115", "130", "150", "175", "200"].includes(String(cached.zoom))) {
    state.previewZoom = String(cached.zoom);
    if (cached.zoom !== "fit") $("#zoom").value = String(cached.zoom);
  }
  applyZoom();
  const restoredMode = ["source", "live", "pdf", "beats"].includes(cached?.previewMode) ? cached.previewMode : "live";
  const requestedMode = restore ? restoredMode : localStorage.getItem("fountain-publisher.preview") || "live";
  const initialMobileMode = initialMobileTab === "source" ? "source" : initialMobileTab === "beats" ? "beats" : "live";
  await setPreviewMode(isMobilePreview() ? initialMobileMode : requestedMode);
  if (restore) requestAnimationFrame(() => {
    const start = Math.min(Number(cached.selectionStart) || 0, source.value.length);
    const end = Math.min(Number(cached.selectionEnd) || start, source.value.length);
    source.setSelectionRange(start, end);
    source.scrollTop = Math.max(0, Number(cached.sourceScrollTop) || 0);
    state.livePreviewScrollTop = Math.max(0, Number(cached.previewScrollTop) || 0);
    state.livePreviewScrollLeft = Math.max(0, Number(cached.previewScrollLeft) || 0);
    $("#preview-scroll").scrollTop = state.livePreviewScrollTop;
    $("#preview-scroll").scrollLeft = state.livePreviewScrollLeft;
    $("#line-numbers").scrollTop = source.scrollTop; syncSourceOverlay(); updateCursor();
    state.cacheEnabled = enableWorkspaceCache;
    scheduleWorkspaceCache();
    toast("Workspace restored");
  });
  else {
    state.cacheEnabled = enableWorkspaceCache;
    scheduleWorkspaceCache();
  }
}

initialize();
