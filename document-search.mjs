import { createSearchClient } from "./search-client.mjs";

const abort = () => new DOMException("Search cancelled", "AbortError");
const sameTarget = (left, right) => left.documentRevision === right.documentRevision
  && left.editRevision === right.editRevision && left.text === right.text && !right.composing;

export function matchIndex(matches, offset, direction = 1, inclusive = false) {
  if (!matches.length) return -1;
  if (direction > 0) {
    const index = matches.findIndex((match) => inclusive ? match.start >= offset : match.start > offset);
    return index < 0 ? 0 : index;
  }
  const index = matches.findLastIndex((match) => inclusive ? match.start <= offset : match.start < offset);
  return index < 0 ? matches.length - 1 : index;
}

// Keep revision checks at the asynchronous boundary, not just in button handlers.
// A queued replacement must never apply to a new document or a collaborator's
// newer revision, even when its text happens to look the same.
export class SearchSession {
  constructor({ getSnapshot, applyEdits, canEdit, client = createSearchClient() }) {
    Object.assign(this, { getSnapshot, applyEdits, canEdit, client });
    this.generation = 0;
  }
  cancel() { this.generation += 1; this.client.cancel(); }
  async run(task, payload) {
    const target = this.getSnapshot();
    if (target.composing) throw new Error("Finish composing text before searching.");
    const generation = ++this.generation;
    const result = await this.client.run(task, { ...payload, text: target.text });
    if (generation !== this.generation) throw abort();
    if (!sameTarget(target, this.getSnapshot())) throw new Error("The document changed. Run the search again.");
    return { ...result, target };
  }
  isCurrent(result) { return Boolean(result) && sameTarget(result.target, this.getSnapshot()); }
  commit(result, edits = result.edits) {
    if (!this.canEdit()) throw new Error("This document is view only or composing text.");
    if (!this.isCurrent(result)) throw new Error("The document changed. Run the replacement again.");
    if (!edits?.length) return false;
    if (!this.applyEdits(edits, result.target)) throw new Error("The document changed or collaboration is not ready. Run the replacement again.");
    return true;
  }
}

export function createDocumentSearch(adapter, root = document) {
  const element = (id) => root.querySelector(`#${id}`);
  const dock = element("search-dock");
  const panel = element("document-search");
  const commandForm = element("vim-command-form");
  const resultsPanel = element("search-results-panel");
  const query = element("search-query");
  const replacement = element("search-replacement");
  const commandInput = element("vim-command-input");
  const session = new SearchSession(adapter);
  let timer = 0;
  let result = null;
  let selected = -1;
  let quickfix = null;
  let quickfixIndex = -1;
  let entry = null;
  let commandKind = ":";
  let commandContext = null;
  let lastVimSearch = null;
  let lastPattern = "";
  let busy = false;
  let uiGeneration = 0;
  const history = [];
  let historyIndex = 0;
  let historyDraft = "";
  let queryComposing = false;
  let commandComposing = false;
  let replacementComposing = false;

  function syncDock() {
    dock.hidden = panel.hidden && commandForm.hidden && resultsPanel.hidden;
    root.body?.classList.toggle("search-open", !dock.hidden);
  }
  function status(message, command = false) {
    const label = element(command ? "vim-command-status" : "search-status");
    label.textContent = message;
    label.dataset.error = "false";
  }
  function options() {
    return { query: query.value, regex: element("search-regex").checked,
      caseSensitive: element("search-case").checked, wholeWord: element("search-word").checked };
  }
  function setControls() {
    const current = session.isCurrent(result) && result.matches.length > 0;
    for (const id of ["search-previous", "search-next"]) element(id).disabled = busy || !current;
    element("search-replace").disabled = busy || !current || !adapter.canEdit();
    element("search-replace-all").disabled = busy || !current || !adapter.canEdit();
  }
  function countStatus(extra = "") {
    const count = result?.matches.length || 0;
    status(`${count ? `${selected + 1} of ${count} matches` : "No matches"}${extra ? ` · ${extra}` : ""}${adapter.canEdit() ? "" : " · View only"}`);
    setControls();
  }
  function fail(error, command = false) {
    if (error.name !== "AbortError") {
      status(error.message || "Search failed.", command);
      element(command ? "vim-command-status" : "search-status").dataset.error = "true";
    }
  }
  function cancelPending() {
    clearTimeout(timer);
    session.cancel();
    uiGeneration += 1;
    busy = false;
    setControls();
  }
  function rememberEntry() {
    entry = adapter.captureSelection();
    adapter.onOpen?.();
  }
  function showMatch(match, { focus = false, vim = false } = {}) {
    return adapter.navigate(match, { focus, vim, surface: entry?.surface });
  }
  function selectResult(index, focus = false) {
    if (!session.isCurrent(result) || index < 0) return;
    selected = index;
    const note = showMatch(result.matches[index], { focus });
    countStatus(note);
  }
  async function search({ move = true, direction = 1, inclusive = true, focus = false } = {}) {
    clearTimeout(timer);
    const generation = ++uiGeneration;
    busy = true;
    setControls();
    const selection = adapter.captureSelection();
    const offset = Math.min(selection.anchor, selection.head);
    const focusOwner = root.activeElement;
    try {
      result = await session.run("search", options());
      if (generation !== uiGeneration) return;
      selected = matchIndex(result.matches, offset, direction, inclusive);
      busy = false;
      const currentSelection = adapter.captureSelection();
      const navigationCurrent = currentSelection.anchor === selection.anchor && currentSelection.head === selection.head
        && root.activeElement === focusOwner;
      if (move && navigationCurrent && result.matches.length) selectResult(selected, focus);
      else countStatus();
      return { generation, result };
    } catch (error) {
      if (generation !== uiGeneration) return;
      result = null;
      busy = false;
      setControls();
      fail(error);
    }
  }
  function changedQuery() {
    cancelPending();
    result = null;
    selected = -1;
    adapter.clearHighlight?.();
    setControls();
    status(query.value ? "Searching…" : "Search the entire open screenplay, including notes and Fountain syntax.");
    if (query.value && !queryComposing) timer = setTimeout(() => void search(), 140);
  }
  function open(replace = false) {
    if (adapter.getSnapshot().composing) return;
    rememberEntry();
    cancelPending();
    commandForm.hidden = true;
    panel.hidden = false;
    element("search-replace-row").hidden = !replace;
    element("search-toggle-replace").setAttribute("aria-expanded", String(replace));
    const selectedText = adapter.getSnapshot().text.slice(Math.min(entry.anchor, entry.head), Math.max(entry.anchor, entry.head));
    if (selectedText && !selectedText.includes("\n") && selectedText.length <= 512) {
      query.value = selectedText;
      element("search-regex").checked = false;
    }
    syncDock();
    query.focus(); query.select();
    changedQuery();
  }
  function close({ restore = true } = {}) {
    cancelPending();
    panel.hidden = true;
    commandForm.hidden = true;
    resultsPanel.hidden = true;
    syncDock();
    adapter.clearHighlight?.();
    if (restore) adapter.restoreSelection(adapter.captureSelection());
    adapter.clearHighlight?.();
  }
  async function next(direction = 1, focus = false) {
    if (queryComposing) return;
    if (!query.value) { open(); return; }
    if (!session.isCurrent(result)) return search({ direction, inclusive: false, focus });
    const selection = adapter.captureSelection();
    const current = result.matches[selected];
    const stillSelected = current && Math.min(selection.anchor, selection.head) === current.start
      && Math.max(selection.anchor, selection.head) === current.end;
    const index = stillSelected ? (selected + direction + result.matches.length) % result.matches.length
      : matchIndex(result.matches, Math.min(selection.anchor, selection.head), direction);
    selectResult(index, focus);
  }
  async function replaceMatches(all) {
    if (queryComposing || commandComposing || replacementComposing) return;
    cancelPending();
    const generation = uiGeneration;
    let ownedGeneration = generation;
    busy = true; setControls();
    const previous = session.isCurrent(result) ? result.matches[selected] : null;
    const selection = adapter.captureSelection();
    const focusOwner = root.activeElement;
    try {
      const plan = await session.run("search", { ...options(), replacement: replacement.value });
      if (generation !== uiGeneration) return;
      if (!plan.matches.length) { result = plan; selected = -1; countStatus(); return; }
      const currentSelection = adapter.captureSelection();
      if (!all && (currentSelection.anchor !== selection.anchor || currentSelection.head !== selection.head || root.activeElement !== focusOwner)) {
        status("Selection changed. Choose a match again before replacing.");
        return;
      }
      if (!all && (!previous || Math.min(selection.anchor, selection.head) !== previous.start || Math.max(selection.anchor, selection.head) !== previous.end)) {
        result = plan;
        selectResult(matchIndex(plan.matches, Math.min(selection.anchor, selection.head), 1, true));
        status("Match selected. Choose Replace to change it.");
        return;
      }
      const edits = all ? plan.edits : plan.edits.filter((edit) => edit.start === previous.start && edit.end === previous.end);
      if (!edits.length) return;
      session.commit(plan, edits);
      // Publishing the edit invalidates old matches synchronously. From here,
      // only this operation's new refresh may update its completion message.
      ownedGeneration = uiGeneration;
      const emptyMatchAdvance = edits[0].start === edits[0].end ? (plan.target.text.codePointAt(edits[0].start) > 0xffff ? 2 : 1) : 0;
      const caret = all ? edits[0].start : edits[0].start + edits[0].text.length + emptyMatchAdvance;
      showMatch({ start: caret, end: caret });
      ownedGeneration = uiGeneration + 1;
      const refreshed = await search({ inclusive: true });
      if (refreshed?.generation === uiGeneration) status(`Replaced ${edits.length} ${edits.length === 1 ? "match" : "matches"}. ${result?.matches.length || 0} remaining.`);
    } catch (error) { if (ownedGeneration === uiGeneration) fail(error); }
    finally { if (ownedGeneration === uiGeneration) { busy = false; setControls(); } }
  }
  function renderQuickfix() {
    const list = element("search-results");
    list.replaceChildren();
    if (!quickfix || !session.isCurrent(quickfix)) return;
    // Bound DOM work independently of the number of matches. Commands can still
    // navigate every result; the list shows the current 100-result window.
    const first = Math.max(0, Math.floor(Math.max(0, quickfixIndex) / 100) * 100);
    const lines = quickfix.target.text.split("\n");
    for (let index = first; index < Math.min(first + 100, quickfix.matches.length); index += 1) {
      const match = quickfix.matches[index];
      const item = root.createElement("li");
      const button = root.createElement("button");
      button.type = "button";
      button.dataset.resultIndex = String(index);
      button.setAttribute("aria-current", String(index === quickfixIndex));
      button.textContent = `${match.line}:${match.column}  ${(lines[match.line - 1] || "").slice(Math.max(0, match.column - 60), match.column + 160)}`;
      item.append(button); list.append(item);
    }
    element("search-results-summary").textContent = `${quickfix.matches.length} matching lines in this screenplay${quickfix.matches.length > 100 ? ` · showing ${first + 1}–${Math.min(first + 100, quickfix.matches.length)}; :cnext / :cprev navigate all` : ""}`;
  }
  function navigateQuickfix(index) {
    if (!session.isCurrent(quickfix)) throw new Error("Search results are stale. Run :grep again.");
    if (!quickfix.matches.length) throw new Error("No matching lines.");
    quickfixIndex = Math.max(0, Math.min(index, quickfix.matches.length - 1));
    showMatch(quickfix.matches[quickfixIndex], { focus: true, vim: true });
    renderQuickfix();
  }
  function openVim(kind, context = {}) {
    if (adapter.getSnapshot().composing) return;
    rememberEntry();
    cancelPending();
    commandKind = kind;
    commandContext = { ...context, target: adapter.getSnapshot(), selection: entry };
    panel.hidden = true;
    commandForm.hidden = false;
    element("vim-command-prefix").textContent = kind;
    commandInput.value = kind === ":" && context.visualRange ? "'<,'>" : "";
    commandInput.setAttribute("aria-label", kind === ":" ? "Vim command" : kind === "/" ? "Search forward" : "Search backward");
    status(kind === ":" ? "Examples: %s/old/new/g · grep /pattern/ · g/pattern/p · cnext. Open screenplay only; JavaScript regex." : "JavaScript regex · Enter searches · Escape cancels · n / N repeat", true);
    historyIndex = history.length;
    historyDraft = commandInput.value;
    syncDock(); commandInput.focus();
  }
  function closeCommand(cancelled = false) {
    cancelPending();
    commandForm.hidden = true;
    syncDock();
    adapter.onVimComplete?.(commandKind);
    if (cancelled && commandContext && sameTarget(commandContext.target, adapter.getSnapshot())) adapter.restoreSelection(commandContext.selection);
    else adapter.restoreSelection(adapter.captureSelection());
  }
  async function vimFind(searchOptions, direction) {
    const selection = adapter.captureSelection();
    const offset = selection.head;
    const focusOwner = root.activeElement;
    const found = await session.run("search", searchOptions);
    const currentSelection = adapter.captureSelection();
    if (root.activeElement !== focusOwner || currentSelection.anchor !== selection.anchor || currentSelection.head !== selection.head) throw abort();
    if (!found.matches.length) throw new Error(`Pattern not found: ${searchOptions.query}`);
    const index = matchIndex(found.matches, offset, direction);
    showMatch(found.matches[index], { focus: true, vim: true });
    return found;
  }
  async function submitCommand() {
    if (commandComposing) return;
    const value = commandInput.value;
    const generation = ++uiGeneration;
    const context = commandContext;
    try {
      if (context && !sameTarget(context.target, adapter.getSnapshot())) throw new Error("The document changed while entering the command. Escape and enter it again.");
      if (commandKind !== ":") {
        const pattern = value || lastVimSearch?.query;
        if (!pattern) throw new Error("No previous search pattern.");
        const searchOptions = { query: pattern, regex: true, caseSensitive: true, vim: true };
        await vimFind(searchOptions, commandKind === "/" ? 1 : -1);
        if (generation !== uiGeneration) return;
        lastVimSearch = { ...searchOptions, direction: commandKind === "/" ? 1 : -1 };
        lastPattern = pattern;
      } else {
        const command = await session.run("ex", { command: value, currentLine: context?.currentLine || 1,
          visualRange: context?.visualRange, lastQuery: lastPattern });
        if (generation !== uiGeneration) return;
        if (command.type === "substitute") {
          if (!command.countOnly) session.commit(command);
          if (command.query) { lastPattern = command.query; lastVimSearch = { query: command.query, regex: true, caseSensitive: command.caseSensitive, direction: 1 }; }
          if (command.edits?.length && !command.countOnly) showMatch({ start: command.edits[0].start, end: command.edits[0].start }, { focus: true, vim: true });
          adapter.notify?.(`${command.count} ${command.countOnly ? "matches" : "substitutions"}${command.countOnly ? " (no changes)" : ""}`);
        } else if (command.type === "grep") {
          quickfix = command; quickfixIndex = -1;
          if (command.query) { lastPattern = command.query; lastVimSearch = { query: command.query, regex: true, caseSensitive: command.caseSensitive, direction: 1 }; }
          resultsPanel.hidden = false;
          renderQuickfix();
          if (command.matches.length) navigateQuickfix(0);
        } else if (command.type === "line") {
          const lines = command.target.text.split("\n");
          const start = lines.slice(0, command.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
          showMatch({ start, end: start }, { focus: true, vim: true });
        } else if (command.type === "quickfix") {
          const action = command.action;
          if (action === "close") resultsPanel.hidden = true;
          else if (action === "open") { if (!session.isCurrent(quickfix)) throw new Error("No current results. Run :grep /pattern/ first."); resultsPanel.hidden = false; renderQuickfix(); }
          else navigateQuickfix(action === "first" ? 0 : action === "last" ? (quickfix?.matches.length || 1) - 1 : quickfixIndex + (action === "previous" ? -1 : 1));
        }
      }
      if (value && history.at(-1)?.value !== value) history.push({ kind: commandKind, value });
      if (history.length > 50) history.shift();
      closeCommand();
    } catch (error) { if (generation === uiGeneration) fail(error, true); }
  }
  async function repeatVim(reverse = false) {
    rememberEntry();
    cancelPending();
    if (!lastVimSearch) { adapter.notify?.("No previous Vim search. Use / or ? first."); return; }
    try { await vimFind(lastVimSearch, lastVimSearch.direction * (reverse ? -1 : 1)); }
    catch (error) { if (error.name !== "AbortError") adapter.notify?.(error.message); }
  }
  function invalidate({ reset = false } = {}) {
    cancelPending(); result = null; selected = -1;
    adapter.clearHighlight?.();
    setControls();
    if (quickfix) { quickfix = null; element("search-results").replaceChildren(); element("search-results-summary").textContent = "Document changed. Run :grep again."; }
    if (reset) {
      close({ restore: false });
      queryComposing = false; commandComposing = false; replacementComposing = false;
      entry = null; commandContext = null;
      lastVimSearch = null; lastPattern = ""; history.length = 0;
      query.value = ""; replacement.value = ""; commandInput.value = "";
    } else if (!panel.hidden && query.value) {
      status("Document changed. Updating matches…");
      timer = setTimeout(() => void search({ move: false }), 180);
    }
  }
  function handleShortcut(event) {
    if (event.defaultPrevented || event.isComposing) return false;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    // This handler also sees ordinary typing in notes and other dialogs. Read
    // editor state and query the DOM only for keys that can be search commands.
    if (key !== "escape" && key !== "f3" && !(modifier && ["f", "h", "g"].includes(key))) return false;
    if (adapter.getSnapshot().composing || root.querySelector("dialog[open]")) return false;
    const target = event.target;
    const inDock = dock.contains(target);
    if (!inDock && target?.closest?.("input, textarea, [contenteditable]") && !adapter.isEditorTarget?.(target)) return false;
    if (modifier && ((!event.altKey && ["f", "h"].includes(key)) || (event.metaKey && event.altKey && key === "f"))) {
      event.preventDefault(); open(key === "h" || event.altKey); return true;
    }
    if (key === "f3" || (modifier && !event.altKey && key === "g")) {
      event.preventDefault(); void next(event.shiftKey ? -1 : 1, !inDock); return true;
    }
    if (key === "escape" && !dock.hidden && commandForm.hidden) {
      event.preventDefault(); close(); return true;
    }
    return false;
  }

  element("menu-find").addEventListener("click", () => open());
  element("menu-replace").addEventListener("click", () => open(true));
  element("search-close").addEventListener("click", () => close());
  element("search-toggle-replace").addEventListener("click", () => {
    const row = element("search-replace-row"); row.hidden = !row.hidden;
    element("search-toggle-replace").setAttribute("aria-expanded", String(!row.hidden));
    if (!row.hidden) replacement.focus();
  });
  for (const id of ["search-query", "search-case", "search-word", "search-regex"]) {
    element(id).addEventListener(id === "search-query" ? "input" : "change", changedQuery);
  }
  replacement.addEventListener("input", cancelPending);
  replacement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !replacementComposing) {
      event.preventDefault(); void replaceMatches(false);
    }
  });
  replacement.addEventListener("compositionstart", () => { replacementComposing = true; cancelPending(); });
  replacement.addEventListener("compositionend", () => { replacementComposing = false; });
  element("search-form").addEventListener("submit", (event) => { event.preventDefault(); void next(); });
  query.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.shiftKey && !event.isComposing) { event.preventDefault(); void next(-1); } });
  element("search-previous").addEventListener("click", () => void next(-1));
  element("search-replace").addEventListener("click", () => void replaceMatches(false));
  element("search-replace-all").addEventListener("click", () => void replaceMatches(true));
  element("search-results-close").addEventListener("click", () => { resultsPanel.hidden = true; syncDock(); });
  element("search-results").addEventListener("click", (event) => {
    const button = event.target.closest("[data-result-index]");
    if (button) try { navigateQuickfix(Number(button.dataset.resultIndex)); } catch (error) { adapter.notify?.(error.message); }
  });
  commandForm.addEventListener("submit", (event) => { event.preventDefault(); void submitCommand(); });
  element("vim-command-close").addEventListener("click", () => closeCommand(true));
  commandInput.addEventListener("input", cancelPending);
  query.addEventListener("compositionstart", () => { queryComposing = true; cancelPending(); });
  query.addEventListener("compositionend", () => { queryComposing = false; changedQuery(); });
  commandInput.addEventListener("compositionstart", () => { commandComposing = true; cancelPending(); });
  commandInput.addEventListener("compositionend", () => { commandComposing = false; });
  dock.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault(); event.stopPropagation(); adapter.onSave?.(event.shiftKey); return;
    }
    if (!commandForm.hidden && event.key === "Escape") { event.preventDefault(); closeCommand(true); }
    else if (!commandForm.hidden && event.target === commandInput && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault(); cancelPending();
      if (historyIndex === history.length) historyDraft = commandInput.value;
      const direction = event.key === "ArrowUp" ? -1 : 1;
      let index = historyIndex + direction;
      while (index >= 0 && index < history.length && history[index].kind !== commandKind) index += direction;
      if (index < 0) return;
      historyIndex = Math.min(history.length, index);
      commandInput.value = historyIndex === history.length ? historyDraft : history[historyIndex]?.value || "";
    } else handleShortcut(event);
    // Editing a search field must never invoke screenplay New/undo/Vim.
    event.stopPropagation();
  });
  setControls();
  return { open, openVim, repeatVim, handleShortcut, invalidate, close, session };
}
