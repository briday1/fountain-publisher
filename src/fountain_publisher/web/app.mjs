import { jsPDF } from "jspdf";

const SAMPLE = `Title: The Last Light
Credit: Written by
Author: Avery Stone
Draft date: August 25, 2026

FADE IN:

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

CUT TO:

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

FADE OUT.
`;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TITLE_KEYS = new Set(["title", "credit", "author", "authors", "source", "draft date", "date", "contact", "copyright", "notes"]);
const source = $("#source");
const page = $("#screenplay-page");
const STATIC_HOST = location.hostname.endsWith(".github.io");
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
  theme: localStorage.getItem("fountain-publisher.theme") || "system",
};

function emptyMetadata() {
  return { lineCount: 1, wordCount: 0, dialogueWords: 0, actionWords: 0, estimatedSeconds: 0, characters: [], scenes: [], sections: [], locations: [], titleFields: [] };
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
  const characters = new Map();
  const scenes = [];
  const locations = new Set();
  const titleFields = [];
  let active = "";
  let currentScene = 0;
  let dialogueWords = 0;
  let actionWords = 0;
  typed.forEach((line, index) => {
    const words = (line.display.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    if (line.prefix) titleFields.push(line.prefix.slice(0, -1));
    if (line.type === "scene") {
      const heading = line.display.replace(/^\./, "").replace(/\s+#[^#]+#\s*$/, "").toUpperCase();
      const number = line.display.match(/#([^#]+)#/)?.[1] || String(scenes.length + 1);
      scenes.push({ number, heading, line: index + 1, words: 0 });
      currentScene = scenes.length;
      const location = heading.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i, "").split(/\s+-\s+/)[0].trim();
      if (location) locations.add(location);
      active = "";
    } else if (line.type === "character") {
      active = cleanCharacter(line.display);
      const entry = characters.get(active) || { name: active, cues: 0, lines: 0, words: 0, seconds: 0, sceneSet: new Set(), lastLine: 0 };
      entry.cues += 1; entry.lastLine = index + 1; if (currentScene) entry.sceneSet.add(currentScene); characters.set(active, entry);
    } else if (line.type === "dialogue") {
      const entry = characters.get(active);
      if (entry) { entry.lines += 1; entry.words += words; dialogueWords += words; }
    } else if (!["empty", "parenthetical", "section", "synopsis", "note", "boneyard", "title-value", "title-value title"].includes(line.type)) {
      active = ""; actionWords += words; if (scenes.length) scenes.at(-1).words += words;
    }
  });
  const characterList = [...characters.values()].map((entry) => ({ ...entry, seconds: Math.round(entry.words / 130 * 60), scenes: entry.sceneSet.size, sceneSet: undefined })).sort((a, b) => b.words - a.words || a.name.localeCompare(b.name));
  const wordCount = dialogueWords + actionWords;
  return { lineCount: lines.length, wordCount, dialogueWords, actionWords, estimatedSeconds: Math.round(wordCount / 180 * 60), characters: characterList, scenes, sections: [], locations: [...locations].sort(), titleFields };
}

function renderPreview({ focusLine = null } = {}) {
  const lines = classifyLines(source.value);
  const scrollTop = $("#preview-scroll").scrollTop;
  page.innerHTML = lines.map((line) => {
    const className = `script-line ${line.type}`;
    const content = line.display ? escapeHtml(line.display) : "<br>";
    return `<div class="${className}" data-line="${line.index}" data-prefix="${escapeHtml(line.prefix)}" contenteditable="plaintext-only" spellcheck="${$("#spellcheck").checked}">${content}</div>`;
  }).join("");
  const meaningful = lines.some((line) => line.raw.trim());
  $("#empty-state").hidden = meaningful;
  page.hidden = state.previewMode !== "live";
  if (focusLine !== null) {
    const target = $(`[data-line="${focusLine}"]`, page);
    target?.focus();
    if (target) placeCaretAtEnd(target);
  } else {
    $("#preview-scroll").scrollTop = scrollTop;
  }
  updatePreviewCursor();
  applyZoom();
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element); range.collapse(false);
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
}

function syncPreviewLine(element) {
  const index = Number(element.dataset.line);
  const lines = source.value.replace(/\r\n?/g, "\n").split("\n");
  let value = element.textContent.replace(/\n/g, "");
  if (element.classList.contains("centered")) value = `> ${value} <`;
  else if (element.classList.contains("lyric")) value = `~${value}`;
  else if (element.classList.contains("character") && lines[index].trim().startsWith("@")) value = `@${value}`;
  else if (element.classList.contains("transition") && lines[index].trim().startsWith(">")) value = `>${value}`;
  else if (element.dataset.prefix) value = `${element.dataset.prefix} ${value}`;
  lines[index] = value;
  source.value = lines.join("\n");
  sourceChanged({ fromPreview: true });
}

function hidePreviewCompletions() {
  $("#preview-completion-menu").hidden = true;
  state.previewCompletionItems = [];
  state.previewCompletionLine = null;
}

function showPreviewCharacterCompletions(element) {
  const fragment = element.textContent.trim().toUpperCase();
  const index = Number(element.dataset.line);
  const previousBlank = index === 0 || !source.value.split("\n")[index - 1]?.trim();
  if (!previousBlank || !/^[A-Z][A-Z0-9 ._'-]*$/.test(fragment)) return hidePreviewCompletions();
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
  const left = Math.max(8, Math.min(panelRect.width - width - 8, anchor.left - panelRect.left));
  const below = anchor.bottom - panelRect.top + 6;
  const top = below + 190 <= panelRect.height ? below : Math.max(8, anchor.top - panelRect.top - 196);
  menu.style.left = `${left}px`; menu.style.top = `${top}px`;
}

function acceptPreviewCharacterCompletion(index = state.previewCompletionIndex) {
  const name = state.previewCompletionItems[index];
  const line = state.previewCompletionLine;
  if (!name || !line) return;
  line.textContent = name;
  syncPreviewLine(line);
  hidePreviewCompletions();
  line.focus(); placeCaretAtEnd(line);
}

function renderEditorChrome() {
  const lineCount = source.value.split("\n").length;
  $("#line-numbers").textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");
  renderSourceSyntax();
  updateCursor();
}

function fountainSyntaxHtml(value) {
  return escapeHtml(value).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g, '<span class="fountain-markup">$1</span>');
}

function renderSourceSyntax() {
  const classes = { scene: "scene", character: "character", dialogue: "dialogue", parenthetical: "parenthetical", transition: "transition", section: "section", synopsis: "synopsis", note: "note", boneyard: "boneyard", lyric: "lyric", "title-value": "title", "title-value title": "title" };
  $("#source-highlight").innerHTML = classifyLines(source.value).map((line) => {
    const name = classes[line.type];
    const value = fountainSyntaxHtml(line.raw) || " ";
    return name ? `<span class="syntax-${name}">${value}</span>` : value;
  }).join("\n");
}

function currentPosition() {
  const before = source.value.slice(0, source.selectionStart);
  const parts = before.split("\n");
  return { line: parts.length - 1, column: parts.at(-1).length, start: before.lastIndexOf("\n") + 1 };
}

function updatePreviewCursor(scroll = false) {
  const target = $(`[data-line="${currentPosition().line}"]`, page);
  $$(".script-line.source-current", page).forEach((line) => line.classList.remove("source-current"));
  target?.classList.add("source-current");
  if (scroll && state.previewMode === "live") target?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function updateCursor({ scrollPreview = false } = {}) {
  const position = currentPosition();
  $("#cursor-position").textContent = `Ln ${position.line + 1}, Col ${position.column + 1}`;
  const type = classifyLines(source.value)[position.line]?.type || "action";
  const labels = { scene: "Scene heading", character: "Character", dialogue: "Dialogue", parenthetical: "Parenthetical", transition: "Transition", "title-value": "Title page", "title-value title": "Title" };
  $("#editor-status").textContent = labels[type] || type[0].toUpperCase() + type.slice(1);
  $("#current-line").style.transform = `translateY(${position.line * 20.15 - source.scrollTop}px)`;
  updatePreviewCursor(scrollPreview);
}

function renderInsights(metadata) {
  state.metadata = metadata;
  const pages = Math.max(metadata.wordCount ? 1 : 0, Math.ceil(metadata.lineCount / 55));
  $("#stat-pages").textContent = pages;
  $("#stat-scenes").textContent = metadata.scenes.length;
  $("#stat-words").textContent = metadata.wordCount.toLocaleString();
  $("#stat-runtime").textContent = formatDuration(metadata.estimatedSeconds);
  $("#character-count").textContent = metadata.characters.length;
  $("#character-list").innerHTML = metadata.characters.length ? `<div class="table-actions"><button type="button" data-copy-characters>Copy table</button></div><table><thead><tr><th>Character</th><th>Lines</th><th>Duration</th></tr></thead><tbody>${metadata.characters.map((character) => `<tr><td><button type="button" data-line="${character.lastLine}">${escapeHtml(character.name)}</button></td><td>${character.lines}</td><td>${formatDuration(character.seconds)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-list">Character statistics appear as dialogue is written.</div>`;
  $("#scene-count").textContent = metadata.scenes.length;
  $("#scene-list").innerHTML = metadata.scenes.length ? metadata.scenes.map((scene) => `<li><span class="scene-num">${escapeHtml(scene.number)}</span><button type="button" data-line="${scene.line}">${escapeHtml(scene.heading)}</button></li>`).join("") : `<li class="empty-list">No scene headings yet.</li>`;
  $("#location-count").textContent = metadata.locations.length;
  $("#location-list").innerHTML = metadata.locations.length ? metadata.locations.map((location) => `<li>${escapeHtml(location)}</li>`).join("") : `<li class="empty-list">No locations yet.</li>`;
  const contentWords = metadata.dialogueWords + metadata.actionWords;
  const dialoguePercent = contentWords ? Math.round(metadata.dialogueWords / contentWords * 100) : 0;
  $("#dialogue-bar").style.width = `${dialoguePercent}%`;
  $("#dialogue-percent").textContent = `${dialoguePercent}%`;
  $("#action-percent").textContent = `${100 - dialoguePercent}%`;
  updatePreviewStatus();
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60); const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function sourceChanged({ fromPreview = false } = {}) {
  document.body.classList.toggle("dirty", source.value !== state.savedSource);
  renderEditorChrome();
  if (!fromPreview) renderPreview();
  renderInsights(analyzeLocally(source.value));
  scheduleCompile();
}

function scheduleCompile(delay = 350) {
  clearTimeout(state.compileTimer);
  state.compileController?.abort();
  const revision = ++state.compileRevision;
  $("#compile-status").textContent = "Editing…";
  $("#compile-status").classList.remove("error");
  if (STATIC_HOST) { $("#compile-status").textContent = "Browser preview"; return; }
  state.compileTimer = setTimeout(() => compile(revision), delay);
}

async function compile(revision) {
  const controller = new AbortController();
  state.compileController = controller;
  $("#compile-status").textContent = "Compiling…";
  try {
    const response = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.value, pageSize: $("#page-size").value }), signal: controller.signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Compilation failed");
    if (revision !== state.compileRevision) return;
    renderInsights(result);
    $("#compile-status").textContent = "Compiled";
  } catch (error) {
    if (error.name === "AbortError") return;
    if (revision !== state.compileRevision) return;
    $("#compile-status").textContent = error.message.includes("fetch") ? "Server unavailable" : "Compile error";
    $("#compile-status").classList.add("error");
  } finally {
    if (state.compileController === controller) state.compileController = null;
  }
}

function completionCandidates() {
  const { line, start } = currentPosition();
  const lines = source.value.split("\n");
  const text = lines[line].slice(0, source.selectionStart - start);
  const trimmed = text.trim();
  const previousBlank = line === 0 || !lines[line - 1].trim();
  const items = [];
  const add = (value, detail, icon = "ƒ") => items.push({ value, detail, icon });
  if (line < 12 && !source.value.slice(0, start).includes("\n\n") && (!trimmed || /^[A-Za-z ]*$/.test(trimmed))) {
    ["Title: ", "Credit: ", "Author: ", "Source: ", "Draft date: ", "Contact: ", "Copyright: ", "Notes: "].filter((key) => !state.metadata.titleFields.some((used) => `${used}:`.toLowerCase() === key.trim().toLowerCase())).forEach((key) => add(key, "Title page", "T"));
  }
  if (/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(trimmed)) {
    ["DAY", "NIGHT", "MORNING", "EVENING", "LATER", "CONTINUOUS", "SAME", "MOMENTS LATER", "DAWN", "DUSK"].forEach((value) => add(value, "Time of day", "◷"));
  } else if (isScene(trimmed) || /^(?:INT|EXT|EST|I\/E)/i.test(trimmed)) {
    state.metadata.locations.forEach((value) => add(value, "Existing location", "⌂"));
  } else if (previousBlank) {
    state.metadata.characters.forEach((character) => add(character.name, `${character.lines} dialogue lines`, "@"));
    ["INT. ", "EXT. ", "INT./EXT. ", "I/E. "].forEach((value) => add(value, "Scene heading", "#"));
    ["FADE IN:", ">CUT TO:", ">FADE OUT."].forEach((value) => add(value, "Transition", "→"));
  }
  const fragment = trimmed.split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();
  return items.filter((item, index) => items.findIndex((other) => other.value === item.value) === index && (!fragment || item.value.toUpperCase().startsWith(fragment) || item.detail === "Existing location"));
}

function showCompletions() {
  state.completionItems = completionCandidates(); state.completionIndex = 0;
  if (!state.completionItems.length) return hideCompletions();
  renderCompletionMenu();
}

function renderCompletionMenu() {
  const menu = $("#completion-menu");
  menu.hidden = false;
  menu.innerHTML = state.completionItems.map((item, index) => `<button class="completion-item ${index === state.completionIndex ? "selected" : ""}" type="button" role="option" aria-selected="${index === state.completionIndex}" data-index="${index}"><span class="completion-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.value)}</span><small>${escapeHtml(item.detail)}</small></button>`).join("");
  $(".completion-item.selected", menu)?.scrollIntoView({ block: "nearest" });
}

function hideCompletions() { $("#completion-menu").hidden = true; state.completionItems = []; }

function acceptCompletion(index = state.completionIndex) {
  const item = state.completionItems[index]; if (!item) return;
  const position = currentPosition();
  const before = source.value.slice(0, source.selectionStart);
  const current = before.slice(position.start);
  let replaceStart = position.start;
  if (/\s-\s/.test(current)) replaceStart = position.start + current.lastIndexOf("-") + 2;
  else if (current.trim()) replaceStart = position.start + current.search(/\S/);
  const suffix = item.icon === "@" ? "\n" : "";
  source.setRangeText(item.value + suffix, replaceStart, source.selectionStart, "end");
  hideCompletions(); sourceChanged();
}

async function newFile() {
  if (!(await confirmDiscard())) return;
  state.handle = null; setDocument("", "Untitled.fountain", true); source.focus();
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

function setDocument(text, filename, saved = false) {
  source.value = text; state.filename = filename || "Untitled.fountain"; if (saved) state.savedSource = text;
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
      download(new Blob([source.value], { type: "text/plain;charset=utf-8" }), normalizedFilename("fountain"));
    }
    state.savedSource = source.value; setDocument(source.value, state.filename, true); toast(`Saved ${state.filename}`);
  } catch (error) { if (error.name !== "AbortError") toast(error.message); }
}

function normalizedFilename(extension) {
  const base = state.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i, "") || "screenplay";
  return `${base}.${extension}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function renderClientFdx() {
  const types = { scene: "Scene Heading", action: "Action", character: "Character", dialogue: "Dialogue", parenthetical: "Parenthetical", transition: "Transition", centered: "Action", lyric: "Lyrics" };
  const paragraphs = classifyLines(source.value).filter((line) => types[line.type] && line.display.trim()).map((line) => `<Paragraph Type="${types[line.type]}"><Text>${xmlEscape(line.display)}</Text></Paragraph>`).join("");
  return new Blob([`<?xml version="1.0" encoding="UTF-8" standalone="no"?><FinalDraft DocumentType="Script" Template="No" Version="1"><Content>${paragraphs}</Content></FinalDraft>`], { type: "application/xml;charset=utf-8" });
}

function renderClientPdf(selectedPageSize = $("#page-size").value) {
  const pageSize = selectedPageSize === "a4" ? "a4" : "letter";
  const pdf = new jsPDF({ unit: "pt", format: pageSize, compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 108; const right = 72; const top = 72; const bottom = 72; const leading = 12;
  const lines = classifyLines(source.value);
  const title = Object.fromEntries(lines.filter((line) => line.prefix).map((line) => [line.prefix.slice(0, -1).toLowerCase(), line.display]));
  const hasTitle = Boolean(title.title || title.author || title.authors || title.credit);
  let y = top;
  const newPage = () => { pdf.addPage(); y = top; };
  const ensure = (height = leading) => { if (y + height > pageHeight - bottom) newPage(); };
  const write = (text, x, width, { align = "left", bold = false, before = 0, after = 0, size = 12 } = {}) => {
    y += before; pdf.setFont("courier", bold ? "bold" : "normal"); pdf.setFontSize(size);
    const wrapped = pdf.splitTextToSize(text || " ", width); ensure(wrapped.length * leading);
    pdf.text(wrapped, x, y, { align }); y += wrapped.length * leading + after;
  };
  if (hasTitle) {
    y = pageHeight / 3;
    if (title.title) write(title.title, pageWidth / 2, pageWidth - 216, { align: "center", size: 10, after: 12 });
    if (title.credit) write(title.credit, pageWidth / 2, pageWidth - 216, { align: "center" });
    if (title.author || title.authors) write(title.author || title.authors, pageWidth / 2, pageWidth - 216, { align: "center" });
    const lower = [title["draft date"], title.contact, title.copyright].filter(Boolean);
    if (lower.length) { y = pageHeight - bottom - lower.length * leading; lower.forEach((value) => write(value, left, pageWidth - left - right)); }
    pdf.addPage(); y = top;
  }
  lines.filter((line) => !line.prefix && !["empty", "title-value", "title-value title", "section", "synopsis", "note", "boneyard", "page-break"].includes(line.type)).forEach((line) => {
    if (line.type === "scene") write(line.display, left, pageWidth - left - right, { bold: true, before: leading, after: leading });
    else if (line.type === "character") write(line.display, left + 137, 250, { before: leading });
    else if (line.type === "dialogue") write(line.display, left + 65, 252);
    else if (line.type === "parenthetical") write(line.display, left + 94, 216);
    else if (line.type === "transition") write(line.display, pageWidth - right, 300, { align: "right", before: leading, after: leading });
    else if (line.type === "centered") write(line.display, pageWidth / 2, pageWidth - left - right, { align: "center", before: leading });
    else write(line.display, left, pageWidth - left - right, { before: line.type === "action" ? leading : 0 });
  });
  return pdf.output("blob");
}

async function requestBinary(path, selectedPageSize = $("#page-size").value) {
  if (STATIC_HOST && path === "/api/render/pdf") return renderClientPdf(selectedPageSize);
  if (STATIC_HOST && path === "/api/export/fdx") return renderClientFdx();
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.value, pageSize: selectedPageSize }) });
  if (!response.ok) { const value = await response.json().catch(() => ({})); throw new Error(value.error || "Export failed"); }
  return response.blob();
}

async function exportDocument(format) {
  $("#confirm-export").disabled = true;
  try {
    let blob;
    if (format === "pdf") blob = await requestBinary("/api/render/pdf", $("#export-page-size").value);
    else if (format === "fdx") blob = await requestBinary("/api/export/fdx");
    else if (STATIC_HOST) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.filename)}</title><link rel="stylesheet" href="styles.css"></head><body><main class="screenplay-page">${page.innerHTML}</main></body></html>`;
      blob = new Blob([html], { type: "text/html;charset=utf-8" });
    } else {
      const response = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.value, includeHtml: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Export failed");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.filename)}</title><style>body{background:#ddd;margin:0;padding:40px;font:12pt Courier,monospace}.screenplay{box-sizing:border-box;width:8.5in;min-height:11in;margin:auto;padding:1in 1in 1in 1.5in;background:white}.dialog{margin-left:1in;width:3.5in}.character{margin-left:1.5in;margin-bottom:0}.parenthetical{margin-left:.5in}.transition{text-align:right}h6{font-size:12pt;margin:2em 0 1em}.action{margin:1em 0}.dual{display:flex}.dual>.left,.dual>.right{width:50%}</style></head><body><main class="screenplay">${result.html}</main></body></html>`;
      blob = new Blob([html], { type: "text/html;charset=utf-8" });
    }
    download(blob, normalizedFilename(format)); $("#export-dialog").close(); toast(`Exported ${format.toUpperCase()}`);
  } catch (error) { toast(error.message); }
  finally { $("#confirm-export").disabled = false; }
}

function openExport(format) {
  $("#export-format").value = format; $("#export-page-size").value = $("#page-size").value; $("#dialog-page-size").hidden = format !== "pdf"; $("#export-dialog").showModal();
}

async function setPreviewMode(mode) {
  state.previewMode = mode; localStorage.setItem("fountain-publisher.preview", mode);
  $$('[data-preview-mode]').forEach((button) => { button.classList.toggle("active", button.dataset.previewMode === mode); const check = $(".menu-check", button); if (check) check.textContent = button.dataset.previewMode === mode ? "✓" : ""; });
  page.hidden = mode !== "live"; $("#empty-state").hidden = mode !== "live" || Boolean(source.value.trim()); $("#pdf-view").hidden = mode !== "pdf";
  $("#preview-scroll").classList.toggle("pdf-mode", mode === "pdf");
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
}

function installResizer(element, variable, side, min, max) {
  let startX = 0; let startWidth = 0;
  const apply = (width) => { const next = Math.max(min, Math.min(max, width)); document.documentElement.style.setProperty(variable, `${next}px`); localStorage.setItem(`fountain-publisher.${variable}`, String(next)); element.setAttribute("aria-valuenow", String(Math.round(next))); };
  element.addEventListener("pointerdown", (event) => { startX = event.clientX; startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable)); element.setPointerCapture(event.pointerId); });
  element.addEventListener("pointermove", (event) => { if (!element.hasPointerCapture(event.pointerId)) return; apply(startWidth + (event.clientX - startX) * side); });
  element.addEventListener("dblclick", () => apply(variable === "--source-w" ? 370 : 310));
  element.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable)); if (event.key === "Home") apply(min); else if (event.key === "End") apply(max); else apply(current + (event.key === "ArrowRight" ? 1 : -1) * side * (event.shiftKey ? 30 : 10)); });
}

function applyZoom() {
  const scale = Number($("#zoom").value) / 100;
  page.style.transform = `scale(${scale})`; page.style.marginBottom = `${1056 * (scale - 1)}px`; page.style.marginRight = `${816 * (scale - 1)}px`;
  updatePreviewStatus();
}

function updatePreviewStatus() {
  const percent = Number($("#zoom").value);
  const total = Math.max(1, Math.ceil((state.metadata.lineCount || 1) / 55));
  const pageHeight = 1056 * percent / 100;
  const current = state.previewMode === "pdf" ? 1 : Math.min(total, Math.max(1, Math.floor($("#preview-scroll").scrollTop / pageHeight) + 1));
  $("#page-estimate").textContent = `${current}/${total}`;
}

function jumpToLine(oneBased, focus = true) {
  const lines = source.value.split("\n"); let offset = 0; for (let i = 0; i < Math.max(0, oneBased - 1); i += 1) offset += lines[i].length + 1;
  if (focus) source.focus();
  source.setSelectionRange(offset, offset + (lines[oneBased - 1]?.length || 0)); updateCursor({ scrollPreview: true });
  const lineHeight = parseFloat(getComputedStyle(source).lineHeight) || 20.15;
  source.scrollTop = Math.max(0, (oneBased - 1) * lineHeight - source.clientHeight / 2);
  $("#line-numbers").scrollTop = source.scrollTop; $("#source-highlight").scrollTop = source.scrollTop; updateCursor({ scrollPreview: true });
}

let toastTimer;
function toast(message) { const element = $("#toast"); element.textContent = message; element.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("show"), 2200); }

const toolbarMenus = $$(".toolbar-menu");

function closeMenus(except = null) { toolbarMenus.forEach((menu) => { if (menu !== except) menu.open = false; }); }

source.addEventListener("input", () => sourceChanged());
source.addEventListener("scroll", () => { $("#line-numbers").scrollTop = source.scrollTop; $("#source-highlight").scrollTop = source.scrollTop; updateCursor(); });
$("#preview-scroll").addEventListener("scroll", updatePreviewStatus);
source.addEventListener("click", () => { updateCursor({ scrollPreview: true }); hideCompletions(); });
source.addEventListener("keyup", (event) => { if (!["Enter", "Tab", "Escape"].includes(event.key)) updateCursor({ scrollPreview: true }); });
source.addEventListener("keydown", (event) => {
  if (!$("#completion-menu").hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); state.completionIndex = (state.completionIndex + (event.key === "ArrowDown" ? 1 : -1) + state.completionItems.length) % state.completionItems.length; renderCompletionMenu(); return; }
    if (event.key === "Tab") { event.preventDefault(); acceptCompletion(); return; }
    if (event.key === "Escape") { event.preventDefault(); hideCompletions(); return; }
  }
  if ((event.ctrlKey || event.metaKey) && event.code === "Space") { event.preventDefault(); showCompletions(); }
  else if (event.key === "Tab") { event.preventDefault(); source.setRangeText("    ", source.selectionStart, source.selectionEnd, "end"); sourceChanged(); }
  else if (["Enter", " ", "-"].includes(event.key)) setTimeout(showCompletions, 0);
});

page.addEventListener("input", (event) => { const line = event.target.closest(".script-line"); if (line) { syncPreviewLine(line); showPreviewCharacterCompletions(line); } });
page.addEventListener("keydown", (event) => {
  const line = event.target.closest(".script-line"); if (!line) return;
  if (!$("#preview-completion-menu").hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); state.previewCompletionIndex = (state.previewCompletionIndex + (event.key === "ArrowDown" ? 1 : -1) + state.previewCompletionItems.length) % state.previewCompletionItems.length; renderPreviewCharacterCompletions(); return; }
    if (event.key === "Tab") { event.preventDefault(); acceptPreviewCharacterCompletion(); return; }
    if (event.key === "Escape") { event.preventDefault(); hidePreviewCompletions(); return; }
  }
  if (event.key === "Enter") {
    event.preventDefault(); syncPreviewLine(line); const index = Number(line.dataset.line); const lines = source.value.split("\n"); lines.splice(index + 1, 0, ""); source.value = lines.join("\n"); sourceChanged(); renderPreview({ focusLine: index + 1 });
  } else if (event.key === "Backspace" && !line.textContent && Number(line.dataset.line) > 0) {
    event.preventDefault(); const index = Number(line.dataset.line); const lines = source.value.split("\n"); lines.splice(index, 1); source.value = lines.join("\n"); sourceChanged(); renderPreview({ focusLine: index - 1 });
  }
});
page.addEventListener("focusin", (event) => { const line = event.target.closest(".script-line"); if (line) jumpToLine(Number(line.dataset.line) + 1, false); });
page.addEventListener("focusout", () => setTimeout(() => { if (!$("#preview-completion-menu").matches(":hover")) hidePreviewCompletions(); }, 0));
$("#preview-completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptPreviewCharacterCompletion(Number(item.dataset.index)); } });
$("#completion-menu").addEventListener("mousedown", (event) => { const item = event.target.closest(".completion-item"); if (item) { event.preventDefault(); acceptCompletion(Number(item.dataset.index)); } });
$("#character-list").addEventListener("click", async (event) => {
  if (event.target.closest("[data-copy-characters]")) {
    const rows = [["Character", "Lines", "Duration"], ...state.metadata.characters.map((character) => [character.name, character.lines, formatDuration(character.seconds)])];
    const text = rows.map((row) => row.join("\t")).join("\n");
    try { await navigator.clipboard.writeText(text); toast("Character table copied"); }
    catch { toast("Clipboard access was denied"); }
    return;
  }
  const button = event.target.closest("button[data-line]"); if (button) jumpToLine(Number(button.dataset.line));
});
$("#scene-list").addEventListener("click", (event) => { const button = event.target.closest("button[data-line]"); if (button) jumpToLine(Number(button.dataset.line)); });

$("#new-file").addEventListener("click", newFile); $("#open-file").addEventListener("click", openFile); $("#save-file").addEventListener("click", () => saveFile(false)); $("#save-file-as").addEventListener("click", () => saveFile(true));
$("#file-input").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) { state.handle = null; setDocument(await file.text(), file.name, true); } event.target.value = ""; });
$("#export-pdf").addEventListener("click", () => openExport("pdf")); $("#export-html").addEventListener("click", () => openExport("html")); $("#export-fdx").addEventListener("click", () => openExport("fdx"));
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
$("#page-size").addEventListener("change", () => { scheduleCompile(0); if (state.previewMode === "pdf") refreshPdf(); });
$$('[data-preview-mode]').forEach((button) => button.addEventListener("click", () => setPreviewMode(button.dataset.previewMode)));
$("#toggle-source").addEventListener("click", () => togglePanel("source")); $("#menu-toggle-source").addEventListener("click", () => togglePanel("source"));
$("#toggle-stats").addEventListener("click", () => togglePanel("stats")); $("#menu-toggle-stats").addEventListener("click", () => togglePanel("stats"));
$("#undo").addEventListener("click", () => { source.focus(); document.execCommand("undo"); sourceChanged(); }); $("#redo").addEventListener("click", () => { source.focus(); document.execCommand("redo"); sourceChanged(); });
$("#zoom").addEventListener("change", applyZoom); $("#zoom-out").addEventListener("click", () => { $("#zoom").selectedIndex = Math.max(0, $("#zoom").selectedIndex - 1); applyZoom(); }); $("#zoom-in").addEventListener("click", () => { $("#zoom").selectedIndex = Math.min($("#zoom").options.length - 1, $("#zoom").selectedIndex + 1); applyZoom(); });
$("#open-docs").addEventListener("click", () => $("#docs-dialog").showModal());
$("#close-docs").addEventListener("click", () => $("#docs-dialog").close());

toolbarMenus.forEach((menu) => menu.addEventListener("click", (event) => {
  if (event.target.closest("button")) menu.open = false;
  else if (event.target.closest("summary")) closeMenus(menu);
}));
document.addEventListener("pointerdown", (event) => toolbarMenus.forEach((menu) => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && toolbarMenus.some((menu) => menu.open)) { closeMenus(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveFile(event.shiftKey); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") { event.preventDefault(); openFile(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); newFile(); }
});
window.addEventListener("beforeunload", (event) => { if (document.body.classList.contains("dirty")) event.preventDefault(); });

async function initialize() {
  setTheme(state.theme);
  const sourceWidth = Number(localStorage.getItem("fountain-publisher.--source-w")); const statsWidth = Number(localStorage.getItem("fountain-publisher.--stats-w"));
  if (sourceWidth) document.documentElement.style.setProperty("--source-w", `${sourceWidth}px`); if (statsWidth) document.documentElement.style.setProperty("--stats-w", `${statsWidth}px`);
  togglePanel("source", localStorage.getItem("fountain-publisher.source-collapsed") === "true"); togglePanel("stats", localStorage.getItem("fountain-publisher.stats-collapsed") === "true");
  installResizer($("#source-resizer"), "--source-w", 1, 250, 650); installResizer($("#stats-resizer"), "--stats-w", -1, 240, 520);
  const params = new URLSearchParams(location.search);
  let text = params.get("demo") === "1" ? SAMPLE : "";
  let name = params.get("demo") === "1" ? "The Last Light.fountain" : "Untitled.fountain";
  if (params.has("project")) {
    try { const response = await fetch("/api/project"); const project = await response.json(); text = project.source; name = project.filename; } catch { /* keep selected blank/demo document */ }
  }
  setDocument(text, name, true);
  await setPreviewMode(localStorage.getItem("fountain-publisher.preview") || "live");
}

initialize();
