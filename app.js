const SAMPLE = `INT. WRITER'S ROOM - DAY

Sunlight spills across pages of notes.

MAYA
Let's keep this draft clean and fast.

ELI
Preview updates should feel instant.

CUT TO:

EXT. CITY STREET - NIGHT

Traffic hums below the office window.
`;

const sourceEditor = document.getElementById("sourceEditor");
const preview = document.getElementById("preview");
const sourceHint = document.getElementById("sourceHint");
const characterList = document.getElementById("characterList");
const openFileInput = document.getElementById("openFileInput");
const characterSidebar = document.getElementById("characterSidebar");

const state = {
  lines: [],
  characters: new Set(),
};

function sanitizeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function detectLineType(text, previousType) {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (/^(INT\.|EXT\.|EST\.|INT\/EXT\.)/.test(trimmed)) return "scene";
  if (trimmed.endsWith("TO:")) return "transition";
  if (/^[A-Z0-9 ()'".-]+$/.test(trimmed) && trimmed.length <= 30 && !trimmed.includes(".")) {
    return "character";
  }
  if (previousType === "character" || previousType === "dialogue") return "dialogue";
  return "action";
}

function parseFountain(source) {
  const rawLines = source.replace(/\r\n/g, "\n").split("\n");
  const parsedLines = [];
  const linesByCharacter = {};
  const characters = new Set();
  let previousType = "empty";
  let activeCharacter = "";

  for (const raw of rawLines) {
    const text = raw.trimEnd();
    const type = detectLineType(text, previousType);
    parsedLines.push({ text, type });
    previousType = type;

    if (type === "character") {
      activeCharacter = text.trim();
      if (activeCharacter) {
        characters.add(activeCharacter);
        if (!linesByCharacter[activeCharacter]) linesByCharacter[activeCharacter] = [];
      }
      continue;
    }

    if (type === "dialogue" && activeCharacter) {
      const dialogue = text.trim();
      if (dialogue) linesByCharacter[activeCharacter].push(dialogue);
    } else if (type !== "empty") {
      activeCharacter = "";
    }
  }

  return { parsedLines, linesByCharacter, characters };
}

function renderPreview(parsedLines) {
  const html = parsedLines
    .map((line) => {
      const display = line.text || " ";
      return `<div class="line ${line.type}" contenteditable="true" data-type="${line.type}">${sanitizeHtml(display)}</div>`;
    })
    .join("");
  preview.innerHTML = html;
}

function renderCharacterSidebar(linesByCharacter, characters) {
  const sorted = [...characters].sort();
  characterList.innerHTML = sorted
    .map((character) => {
      const lines = linesByCharacter[character] || [];
      const summary = lines.length
        ? `<ul>${lines.map((line) => `<li>${sanitizeHtml(line)}</li>`).join("")}</ul>`
        : "<p>No dialogue lines yet.</p>";
      return `<li><strong>${sanitizeHtml(character)}</strong>${summary}</li>`;
    })
    .join("");
}

function updateSourceHint(parsedLines) {
  const currentLine = sourceEditor.value.substring(0, sourceEditor.selectionStart).split("\n").at(-1) || "";
  const upper = currentLine.toUpperCase().trim();
  const characterMatches = [...state.characters].filter((name) => name.startsWith(upper) && name !== upper);
  let category = "action";

  if (parsedLines.length) {
    const selectedLineIndex = sourceEditor.value.substring(0, sourceEditor.selectionStart).split("\n").length - 1;
    category = parsedLines[selectedLineIndex]?.type || "action";
  }

  if (characterMatches.length) {
    sourceHint.textContent = `Line type: ${category}. Character suggestion: ${characterMatches[0]} (press Tab).`;
    return;
  }

  sourceHint.textContent = `Line type: ${category}. Scene headings (INT./EXT.), CHARACTER, dialogue, action, and transitions are auto-detected.`;
}

function syncFromSource() {
  const { parsedLines, linesByCharacter, characters } = parseFountain(sourceEditor.value);
  state.lines = parsedLines;
  state.characters = characters;
  renderPreview(parsedLines);
  renderCharacterSidebar(linesByCharacter, characters);
  updateSourceHint(parsedLines);
}

function syncFromPreview() {
  const lines = [...preview.querySelectorAll(".line")].map((node) => node.textContent.replace(/\u00a0/g, " "));
  sourceEditor.value = lines.join("\n");
  syncFromSource();
}

function onPreviewKeydown(event) {
  if (event.key !== "Enter") return;

  const line = event.target.closest(".line");
  if (!line) return;

  event.preventDefault();
  const type = line.dataset.type || "action";
  const nextType = type === "character" ? "dialogue" : type;
  const newLine = document.createElement("div");
  newLine.className = `line ${nextType}`;
  newLine.dataset.type = nextType;
  newLine.contentEditable = "true";
  newLine.textContent = "";
  line.after(newLine);
  newLine.focus();
}

function applyCharacterAutocomplete(event) {
  if (event.key !== "Tab") return;
  const beforeCursor = sourceEditor.value.substring(0, sourceEditor.selectionStart);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const currentLine = beforeCursor.slice(lineStart);
  const upper = currentLine.trim().toUpperCase();
  if (!upper) return;

  const match = [...state.characters]
    .sort()
    .find((name) => name.startsWith(upper) && name !== upper);

  if (!match) return;
  event.preventDefault();

  const afterCursor = sourceEditor.value.substring(sourceEditor.selectionStart);
  const replacement = `${beforeCursor.slice(0, lineStart)}${match}`;
  sourceEditor.value = replacement + afterCursor;
  sourceEditor.selectionStart = replacement.length;
  sourceEditor.selectionEnd = replacement.length;
  syncFromSource();
}

document.getElementById("newFileBtn").addEventListener("click", () => {
  sourceEditor.value = "";
  syncFromSource();
});

document.getElementById("openFileBtn").addEventListener("click", () => {
  openFileInput.click();
});

openFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  sourceEditor.value = await file.text();
  syncFromSource();
});

document.getElementById("saveFileBtn").addEventListener("click", () => {
  const blob = new Blob([sourceEditor.value], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "screenplay.fountain";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("toggleSidebarBtn").addEventListener("click", () => {
  characterSidebar.classList.toggle("is-collapsed");
});

sourceEditor.addEventListener("input", syncFromSource);
sourceEditor.addEventListener("click", () => updateSourceHint(state.lines));
sourceEditor.addEventListener("keyup", () => updateSourceHint(state.lines));
sourceEditor.addEventListener("keydown", applyCharacterAutocomplete);
preview.addEventListener("input", syncFromPreview);
preview.addEventListener("keydown", onPreviewKeydown);

sourceEditor.value = SAMPLE;
syncFromSource();
