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
const MANAGED_NOTE_RE = /^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/;
const source = $("#source");
const page = $("#screenplay-page");
const WORKSPACE_CACHE_KEY = "fountain-publisher.workspace.v1";
const GITHUB_BROWSER_KEY = "fountain-publisher.github-browser.v1";
const GITHUB_API = "https://api.fountain-publisher.com";
let STATIC_HOST = location.hostname.endsWith(".github.io") || new URLSearchParams(location.search).get("static") === "1";
const docSettings = {
  sceneNumbers: localStorage.getItem("fountain-publisher.scene-numbers") ?? "margin",
  sceneNumberFormat: localStorage.getItem("fountain-publisher.scene-number-format") ?? "sequential",
};
function setDocSetting(key, value) { docSettings[key] = value; localStorage.setItem(`fountain-publisher.${key}`, value); }
const state = {
  filename: "Untitled.fountain",
  handle: null,
  savedSource: "",
  metadata: emptyMetadata(),
  compileTimer: 0,
  compileRevision: 0,
  compileController: null,
  completionItems: [],
  completionIndex: 0,
  previewCompletionItems: [],
  previewCompletionIndex: 0,
  previewCompletionLine: null,
  previewMode: "live",
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
};

function emptyMetadata() {
  return { lineCount: 1, wordCount: 0, dialogueWords: 0, actionWords: 0, estimatedSeconds: 0, characters: [], scenes: [], sections: [], locations: [], titleFields: [], generalNotes: [], characterNotes: {} };
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
      previewScrollTop: $("#preview-scroll").scrollTop,
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

function applyPreviewBackground() {
  const storedPattern = localStorage.getItem("fountain-publisher.preview-background") || "dots";
  const pattern = ["blank", "dots"].includes(storedPattern) ? storedPattern : "dots";
  const storedRadius = Number(localStorage.getItem("fountain-publisher.preview-dot-radius"));
  const radius = storedRadius >= .6 && storedRadius <= 1.8 ? storedRadius : 1;
  const preview = $("#preview-scroll");
  preview.dataset.background = pattern;
  preview.style.setProperty("--preview-dot-radius", `${radius}px`);
  $("#preview-background").value = pattern;
  $("#preview-dot-radius").value = String(radius);
  $("#preview-dot-radius-value").textContent = `${radius.toFixed(1)}px`;
  $("#preview-dot-radius-row").hidden = pattern !== "dots";
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
  });
  return { generalNotes, characterNotes };
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
  return { lineCount: lines.length, wordCount, dialogueWords, actionWords, estimatedSeconds: pageCount == null ? 0 : pageCount * 60, characters: characterList, scenes, sections, locations: [...locations].sort(), titleFields, pageCount, ...notes };
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
  return `<div class="${className}" data-line="${line.index}" data-prefix="${escapeHtml(prefix)}" data-scene-number="${sceneAttr}" data-display="${escapeHtml(display)}">${content}${orb}</div>`;
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

function renderPreview({ focusLine = null, focusOffset = null } = {}) {
  const lines = classifyLines(source.value);
  const previewScroll = $("#preview-scroll");
  const stage = $("#preview-page-stage");
  const scrollTop = previewScroll.scrollTop;
  const scrollLeft = previewScroll.scrollLeft;
  page.innerHTML = renderPreviewLines(lines);
  page.spellcheck = $("#spellcheck").checked;
  const meaningful = lines.some((line) => line.raw.trim());
  $("#empty-state").hidden = meaningful;
  stage.hidden = state.previewMode !== "live";
  page.hidden = state.previewMode !== "live";
  if (focusLine !== null) {
    const target = $(`[data-line="${focusLine}"]`, page);
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
  updatePreviewCursor();
  applyZoom();
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
    renderPreview({ focusLine, focusOffset });
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
    const candidates = $$(".script-line[data-display]", page);
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
  const highlightRect = highlight.getBoundingClientRect();
  const numbers = source.value.split("\n").map((line, index) => {
    const sourceLine = $(`[data-source-line="${index}"]`, highlight);
    const firstRect = sourceLine?.getClientRects()[0];
    const top = firstRect ? firstRect.top - highlightRect.top + highlight.scrollTop : 0;
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
  $("#source-highlight").innerHTML = lines.map((line, index) => {
    const name = classes[line.type];
    const value = fountainSyntaxHtml(line.raw) || " ";
    const newline = index < lines.length - 1 ? "\n" : "";
    return `<span data-source-line="${line.index}"${name ? ` class="syntax-${name}"` : ""}>${value}${newline}</span>`;
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
  const targetRect = target.getBoundingClientRect();
  const scrollRect = previewScroll.getBoundingClientRect();
  let top = previewScroll.scrollTop;
  let left = previewScroll.scrollLeft;
  if (block === "center") top += targetRect.top - scrollRect.top - (previewScroll.clientHeight - targetRect.height) / 2;
  else if (targetRect.top < scrollRect.top) top += targetRect.top - scrollRect.top;
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
  const firstRect = target?.getClientRects()[0];
  if (!firstRect) return;
  const computed = getComputedStyle(source);
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;
  const lineHeight = parseFloat(computed.lineHeight) || 20.15;
  const top = firstRect.top - highlight.getBoundingClientRect().top + highlight.scrollTop;
  const bottom = top + lineHeight;
  let next = source.scrollTop;
  if (block === "center") next = top - (source.clientHeight - lineHeight) / 2;
  else if (top < source.scrollTop + paddingTop) next = top - paddingTop;
  else if (bottom > source.scrollTop + source.clientHeight - paddingBottom) next = bottom - source.clientHeight + paddingBottom;
  source.scrollTop = Math.max(0, next);
  syncSourceOverlay();
  $("#line-numbers").scrollTop = source.scrollTop;
}

function updatePreviewCursor(scroll = false, scrollBlock = "nearest") {
  const target = $(`[data-line="${currentPosition().line}"]`, page);
  $$(".script-line.source-current", page).forEach((line) => line.classList.remove("source-current"));
  target?.classList.add("source-current");
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
    ? sourceLine.getBoundingClientRect().top - source.getBoundingClientRect().top - parseFloat(computed.paddingTop)
    : -source.scrollTop;
  $("#current-line").style.height = `${lineHeight}px`;
  $("#current-line").style.transform = `translateY(${lineTop}px)`;
  updatePreviewCursor(scrollPreview, scrollBlock);
}

function renderInsights(metadata) {
  state.metadata = metadata;
  $("#stat-pages").textContent = metadata.pageCount ?? "—";
  $("#stat-scenes").textContent = metadata.scenes.length;
  $("#stat-words").textContent = metadata.wordCount.toLocaleString();
  $("#scene-count").textContent = metadata.scenes.length;
  $("#character-count").textContent = metadata.characters.length;
  $("#scene-list").innerHTML = renderOutline(metadata);
  renderCharacterTable();
  renderGeneralNotes();
  const contentWords = metadata.dialogueWords + metadata.actionWords;
  const dialoguePercent = contentWords ? Math.round(metadata.dialogueWords / contentWords * 100) : 0;
  $("#dialogue-bar").style.width = `${dialoguePercent}%`;
  $("#dialogue-percent").textContent = `${dialoguePercent}%`;
  $("#action-percent").textContent = `${100 - dialoguePercent}%`;
  if ($("#character-analytics-dialog").open) renderCharacterAnalytics();
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

function fitCanvasText(context, value, width) {
  const text = String(value);
  if (context.measureText(text).width <= width) return text;
  let clipped = text;
  while (clipped.length && context.measureText(`${clipped}…`).width > width) clipped = clipped.slice(0, -1);
  return clipped ? `${clipped}…` : "";
}

function renderCharacterAnalytics() {
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

  const surface = canvasColor("--surface", "#fff");
  const surface2 = canvasColor("--surface-2", "#f2f2f2");
  const ink = canvasColor("--ink", "#202124");
  const muted = canvasColor("--muted", "#6b7280");
  const border = canvasColor("--border", "#d7d9dd");
  const characterColor = canvasColor("--syntax-character", "#7c3aed");
  const lineCounts = characters.flatMap((character) => (character.sceneLines || []).map((item) => item.lines)).filter((lines) => lines > 0);
  const minLines = lineCounts.length ? Math.min(...lineCounts) : 0;
  const maxLines = lineCounts.length ? Math.max(...lineCounts) : 0;
  const legend = $("#character-analytics-legend");
  legend.hidden = !lineCounts.length;
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
    scenes.forEach((scene, index) => {
      const lineCount = usage.get(index + 1) || 0;
      if (!lineCount) return;
      const x = labelWidth + index * sceneWidth + 4;
      const intensity = maxLines === minLines ? 1 : 0.25 + 0.75 * ((lineCount - minLines) / (maxLines - minLines));
      context.save();
      context.globalAlpha = intensity;
      context.fillStyle = characterColor;
      context.fillRect(x, y + 7, sceneWidth - 8, rowHeight - 14);
      context.restore();
      context.fillStyle = intensity >= 0.6 ? "#fff" : ink;
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
  renderCharacterAnalytics();
  $("#character-analytics-dialog").showModal();
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
  state.historyIndex = index; source.value = state.history[index]; sourceChanged({ fromPreview: previewLine !== null, record: false });
  if (previewLine !== null) renderPreview({ focusLine: Math.min(previewLine, source.value.split("\n").length - 1) });
  else { source.focus(); source.setSelectionRange(Math.min(sourcePosition, source.value.length), Math.min(sourcePosition, source.value.length)); }
}

function undoDocument() { restoreHistory(state.historyIndex - 1); }
function redoDocument() { restoreHistory(state.historyIndex + 1); }

function sourceChanged({ fromPreview = false, record = true } = {}) {
  if (record) recordHistory();
  document.body.classList.toggle("dirty", source.value !== state.savedSource);
  renderEditorChrome();
  if (!fromPreview) renderPreview();
  renderInsights(analyzeLocally(source.value));
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
    const pageCount = await countPdfBlobPages(blob);
    if (revision !== state.compileRevision) return;
    state.metadata.pageCount = pageCount;
    state.metadata.estimatedSeconds = pageCount * 60;
    $("#stat-pages").textContent = pageCount;
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
    if (result.pageCount == null) result.pageCount = await countPdfBlobPages(await requestBinary("/api/render/pdf"));
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
  state.githubFile = githubFile;
  $("#filename").textContent = state.filename; document.title = `${state.filename} — Fountain Publisher`; sourceChanged();
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

async function connectGithub() {
  if (state.githubConnected) return openGithubBrowser();
  openGithubPopup(`${GITHUB_API}/auth/github/start`);
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
  state.githubBrowserMode = mode;
  $("#github-dialog-title").textContent = mode === "save" ? "Save to GitHub" : "Open from GitHub";
  $("#github-save-panel").hidden = mode !== "save";
  if (mode === "save") {
    $("#github-filename").value = normalizedFilename("fountain");
    $("#github-save-status").textContent = "";
  }
  $("#github-save-details").open = mode === "save" && !matchMedia("(max-width: 640px)").matches;
  $("#github-dialog").showModal();
  try { await loadGithubRepositories(); } catch (error) { toast(error.message); }
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
  if (matchMedia("(max-width: 640px)").matches && navigator.share && navigator.canShare?.(shareData)) {
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
import re
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
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

def _fp_compile(source, kind, page_size, scene_numbers="margin", scene_number_format="sequential"):
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
        class NumberedDocTemplate(pdf.DocTemplate):
            def handle_pageBegin(self):
                _font_settings = getattr(self.settings, "font_settings", None)
                self.canv.setFont(getattr(_font_settings, "family_name", "Courier"), self.settings.font_size, leading=self.settings.line_height)
                page = self.page if self.has_title_page else self.page + 1
                if page >= 1:
                    self.canv.drawRightString(self.settings.left_margin + self.settings.frame_width, self.settings.page_height - 42, f"{page}.")
                self._handle_pageBegin()
        pdf.to_pdf(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings)
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
  const bytes = value instanceof Uint8Array ? value : value.toJs();
  value.destroy?.();
  const types = { pdf: "application/pdf", fdx: "application/xml;charset=utf-8" };
  return new Blob([bytes], { type: types[kind] });
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
  return matchMedia("(max-width: 640px)").matches;
}

async function setPreviewMode(mode) {
  if (isMobilePreview()) mode = "live";
  state.previewMode = mode; localStorage.setItem("fountain-publisher.preview", mode);
  $$('[data-preview-mode]').forEach((button) => { button.classList.toggle("active", button.dataset.previewMode === mode); const check = $(".menu-check", button); if (check) check.textContent = button.dataset.previewMode === mode ? "✓" : ""; });
  $("#preview-page-stage").hidden = mode !== "live"; page.hidden = mode !== "live"; $("#empty-state").hidden = mode !== "live" || Boolean(source.value.trim()); $("#pdf-view").hidden = mode !== "pdf";
  $("#preview-scroll").classList.toggle("pdf-mode", mode === "pdf");
  scheduleWorkspaceCache();
  if (mode === "pdf") await refreshPdf();
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
  $("#theme-value").textContent = effective[0].toUpperCase() + effective.slice(1);
  $("#theme").title = `Switch to ${effective === "dark" ? "light" : "dark"} mode`;
}

function cycleTheme() {
  const effective = document.documentElement.dataset.effectiveTheme || "light";
  setTheme(effective === "dark" ? "light" : "dark");
}

function togglePanel(panel, force) {
  const collapsed = force ?? !document.body.classList.contains(`${panel}-collapsed`);
  document.body.classList.toggle(`${panel}-collapsed`, collapsed); localStorage.setItem(`fountain-publisher.${panel}-collapsed`, String(collapsed));
  $(`#toggle-${panel}`).setAttribute("aria-expanded", String(!collapsed));
  $(`#menu-toggle-${panel}`).textContent = `${collapsed ? "Show" : "Hide"} ${panel === "stats" ? "Insights" : "Source"}`;
  if (state.previewZoom === "fit") requestAnimationFrame(applyZoom);
}

function installResizer(element, variable, side, min, max) {
  let startX = 0; let startWidth = 0;
  const apply = (width) => { const next = Math.max(min, Math.min(max, width)); document.documentElement.style.setProperty(variable, `${next}px`); localStorage.setItem(`fountain-publisher.${variable}`, String(next)); element.setAttribute("aria-valuenow", String(Math.round(next))); if (variable === "--source-w") renderEditorChrome(); if (state.previewZoom === "fit") requestAnimationFrame(applyZoom); };
  element.addEventListener("pointerdown", (event) => { startX = event.clientX; startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable)); element.setPointerCapture(event.pointerId); });
  element.addEventListener("pointermove", (event) => { if (!element.hasPointerCapture(event.pointerId)) return; apply(startWidth + (event.clientX - startX) * side); });
  element.addEventListener("dblclick", () => apply(variable === "--source-w" ? 370 : 310));
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
  $("#zoom-fit").setAttribute("aria-pressed", String(zoom === "fit"));
  if (isMobilePreview()) {
    const scale = zoom === "fit" ? 1 : Number(zoom) / 100;
    fitOption.hidden = zoom !== "fit";
    if (zoom === "fit") { fitOption.textContent = "100%"; zoomControl.value = "fit"; }
    else zoomControl.value = zoom;
    page.style.transform = "none"; page.style.marginBottom = "0"; page.style.marginRight = "0";
    $("#preview-page-stage").style.removeProperty("width");
    $("#preview-page-stage").style.removeProperty("min-height");
    page.style.setProperty("--mobile-preview-zoom", scale);
    requestAnimationFrame(() => clampPreviewScroll());
    scheduleWorkspaceCache();
    return;
  }
  page.style.removeProperty("--mobile-preview-zoom");
  let scale = Number(zoom) / 100;
  if (zoom === "fit") {
    const preview = $("#preview-scroll");
    const style = getComputedStyle(preview);
    const availableWidth = preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    scale = Math.max(.25, Math.min(2, availableWidth / 816));
  }
  fitOption.hidden = zoom !== "fit";
  if (zoom === "fit") {
    fitOption.textContent = `${Math.round(scale * 100)}%`;
    zoomControl.value = "fit";
  } else zoomControl.value = zoom;
  const stage = $("#preview-page-stage");
  stage.style.width = `${816 * scale}px`; stage.style.minHeight = `${Math.max(1056, page.scrollHeight) * scale}px`;
  page.style.transform = `scale(${scale})`; page.style.marginBottom = "0"; page.style.marginRight = "0";
  const preview = $("#preview-scroll");
  requestAnimationFrame(() => {
    preview.scrollLeft = Math.max(0, (preview.scrollWidth - preview.clientWidth) / 2);
    clampPreviewScroll(preview);
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
  source.value = lines.join("\n").replace(/\n{3,}$/g, "\n\n");
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

function openAnnotationEditor(line = null, insertAfter = null) {
  const existing = line === null ? "" : annotationText(sourceLines()[line] || "");
  state.noteEditor = { kind: "annotation", line, insertAfter };
  $("#annotation-heading").textContent = line === null ? "Add annotation" : "Edit annotation";
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

function showPreviewContextMenu(line, clientX, clientY) {
  const menu = $("#preview-context-menu");
  const selection = previewSelectionInPage();
  state.previewContextLine = Number(line.dataset.line);
  state.previewContextEdit = previewSelection(previewLineForNode(selection?.focusNode) || line);
  state.previewContextText = selection?.toString() || "";
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, clientX))}px`;
  let top = clientY;
  if (isMobilePreview() && state.previewContextText && selection.rangeCount) {
    const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    const below = selectionRect.bottom + 12;
    const above = selectionRect.top - height - 12;
    top = below + height <= window.innerHeight - 8 ? below : above;
  }
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, top))}px`;
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

source.addEventListener("input", (event) => {
  sourceChanged();
  if (event.inputType === "insertText") showCompletions();
  else hideCompletions();
});
source.addEventListener("scroll", () => { $("#line-numbers").scrollTop = source.scrollTop; syncSourceOverlay(); updateCursor(); scheduleWorkspaceCache(); });
source.addEventListener("click", () => { updateCursor({ scrollPreview: true }); hideCompletions(); scheduleWorkspaceCache(); });
source.addEventListener("select", () => { updateCursor({ scrollPreview: true }); scheduleWorkspaceCache(); });
source.addEventListener("keyup", (event) => { if (!["Enter", "Tab", "Escape"].includes(event.key)) updateCursor({ scrollPreview: true }); scheduleWorkspaceCache(); });
source.addEventListener("keydown", (event) => {
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
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); if (!line) return;
  if (!$("#preview-completion-menu").hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); state.previewCompletionIndex = (state.previewCompletionIndex + (event.key === "ArrowDown" ? 1 : -1) + state.previewCompletionItems.length) % state.previewCompletionItems.length; renderPreviewCharacterCompletions(); return; }
    if (event.key === "Tab") { event.preventDefault(); acceptPreviewCharacterCompletion(); return; }
    if (event.key === "Escape") { event.preventDefault(); hidePreviewCompletions(); return; }
  }
  const verticalDirection = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  const atVerticalEdge = verticalDirection === -1
    ? previewCaretIsOnVisualEdge(line, "first")
    : verticalDirection === 1 && previewCaretIsOnVisualEdge(line, "last");
  if (verticalDirection && atVerticalEdge) {
    const edit = previewSelection(line);
    const adjacent = $(`[data-line="${Number(line.dataset.line) + verticalDirection}"]`, page);
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
page.addEventListener("pointerup", (event) => { const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); const edit = previewSelection(line); if (edit) setSourceSelectionFromPreview(edit); });
page.addEventListener("keyup", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const line = previewLineForNode(getSelection()?.focusNode) || event.target.closest(".script-line"); const edit = previewSelection(line); if (edit) setSourceSelectionFromPreview(edit);
});
page.addEventListener("focusout", () => setTimeout(() => { if (!$("#preview-completion-menu").matches(":hover")) hidePreviewCompletions(); }, 0));
page.addEventListener("contextmenu", (event) => {
  const line = event.target.closest(".script-line");
  if (!line || event.target.closest(".annotation-orb")) return;
  event.preventDefault();
  hidePreviewCompletions();
  const selection = previewSelectionInPage();
  if (!selection || selection.isCollapsed) placePreviewCaretFromPoint(line, event.clientX, event.clientY);
  showPreviewContextMenu(line, event.clientX, event.clientY);
});
page.addEventListener("click", (event) => {
  hidePreviewContextMenu();
  const orb = event.target.closest(".annotation-orb");
  if (orb) { event.preventDefault(); openAnnotationEditor(Number(orb.dataset.annotationLine)); }
});
$("#preview-context-menu").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-preview-menu-action]");
  if (!button) return;
  const { previewContextLine, previewContextEdit: edit, previewContextText: text } = state;
  const action = button.dataset.previewMenuAction;
  hidePreviewContextMenu();
  if (action === "annotation") return openAnnotationEditor(null, previewContextLine);
  const message = await runPreviewClipboardAction(action, previewContextLine, { edit, text });
  if (message) toast(message);
});
$("#preview-completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptPreviewCharacterCompletion(Number(item.dataset.index)); } });
$("#completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptCompletion(Number(item.dataset.index)); } });
$("[data-character-analytics]").addEventListener("click", openCharacterAnalytics);
$("#close-character-analytics").addEventListener("click", () => $("#character-analytics-dialog").close());
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
$("#clear-workspace-on-exit").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.clear-workspace-on-exit", String(event.target.checked));
  if (event.target.checked) clearWorkspaceCache();
  else scheduleWorkspaceCache();
});
$("#open-background-dialog").addEventListener("click", () => $("#background-dialog").showModal());
$("#preview-background").addEventListener("change", (event) => {
  localStorage.setItem("fountain-publisher.preview-background", event.target.value);
  applyPreviewBackground();
});
$("#preview-dot-radius").addEventListener("input", (event) => {
  localStorage.setItem("fountain-publisher.preview-dot-radius", event.target.value);
  applyPreviewBackground();
});
$("#page-size").addEventListener("change", () => { scheduleCompile(0); if (state.previewMode === "pdf") refreshPdf(); });
$$('[data-preview-mode]').forEach((button) => button.addEventListener("click", () => setPreviewMode(button.dataset.previewMode)));
$("#toggle-source").addEventListener("click", () => togglePanel("source")); $("#menu-toggle-source").addEventListener("click", () => togglePanel("source"));
$("#toggle-stats").addEventListener("click", () => togglePanel("stats")); $("#menu-toggle-stats").addEventListener("click", () => togglePanel("stats"));
$("#undo").addEventListener("click", undoDocument); $("#redo").addEventListener("click", redoDocument);
$("#zoom").addEventListener("change", () => { state.previewZoom = $("#zoom").value; applyZoom(); }); $("#zoom-out").addEventListener("click", () => stepZoom(-1)); $("#zoom-in").addEventListener("click", () => stepZoom(1)); $("#zoom-fit").addEventListener("click", () => { state.previewZoom = "fit"; applyZoom(); });
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
  if (panel === "preview" && isMobilePreview() && state.previewMode !== "live") void setPreviewMode("live");
  else if (panel === "preview" && state.previewMode === "pdf") refreshPdf();
  if (panel === "source") { renderEditorChrome(); scrollSourceTarget(currentPosition().line, "center"); }
  if (panel !== "stats" && state.insightLine !== null) requestAnimationFrame(() => jumpToLine(state.insightLine, false));
}

$$(".mobile-tab").forEach((tab) => tab.addEventListener("click", () => setMobileTab(tab.dataset.mobilePanel)));
$("#preview-scroll").addEventListener("scroll", () => { hidePreviewContextMenu(); scheduleWorkspaceCache(); });

toolbarMenus.forEach((menu) => menu.addEventListener("click", (event) => {
  if (event.target.closest("button")) menu.open = false;
  else if (event.target.closest("summary")) closeMenus(menu);
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
  applyZoom();
});

async function initialize() {
  updateMobileViewport();
  setTheme(state.theme);
  applyPreviewBackground();
  const isMac = /Mac/i.test(navigator.platform) || /Mac/i.test(navigator.userAgentData?.platform || "");
  document.documentElement.dataset.os = isMac ? "mac" : "win";
  const wordWrap = localStorage.getItem("fountain-publisher.word-wrap") !== "false";
  $("#word-wrap").checked = wordWrap; document.body.classList.toggle("source-wrap", wordWrap); source.setAttribute("wrap", wordWrap ? "soft" : "off");
  $("#clear-workspace-on-exit").checked = clearWorkspaceOnExit();
  document.body.classList.add(`scene-nums-${docSettings.sceneNumbers}`);
  const sourceWidth = Number(localStorage.getItem("fountain-publisher.--source-w")); const statsWidth = Number(localStorage.getItem("fountain-publisher.--stats-w"));
  if (sourceWidth) document.documentElement.style.setProperty("--source-w", `${sourceWidth}px`); if (statsWidth) document.documentElement.style.setProperty("--stats-w", `${statsWidth}px`);
  togglePanel("source", localStorage.getItem("fountain-publisher.source-collapsed") === "true"); togglePanel("stats", localStorage.getItem("fountain-publisher.stats-collapsed") === "true");
  installResizer($("#source-resizer"), "--source-w", 1, 250, 650); installResizer($("#stats-resizer"), "--stats-w", -1, 240, 520);
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
  setMobileTab(localStorage.getItem("fountain-publisher.mobile-tab") || "source");
  if (restore && ["fit", "70", "85", "100", "115", "130", "150", "175", "200"].includes(String(cached.zoom))) {
    state.previewZoom = String(cached.zoom);
    if (cached.zoom !== "fit") $("#zoom").value = String(cached.zoom);
  }
  applyZoom();
  const restoredMode = ["live", "pdf"].includes(cached?.previewMode) ? cached.previewMode : "live";
  await setPreviewMode(restore ? restoredMode : localStorage.getItem("fountain-publisher.preview") || "live");
  if (restore) requestAnimationFrame(() => {
    const start = Math.min(Number(cached.selectionStart) || 0, source.value.length);
    const end = Math.min(Number(cached.selectionEnd) || start, source.value.length);
    source.setSelectionRange(start, end);
    source.scrollTop = Math.max(0, Number(cached.sourceScrollTop) || 0);
    $("#preview-scroll").scrollTop = Math.max(0, Number(cached.previewScrollTop) || 0);
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
