import * as Y from "./vendor/yjs.mjs";

const API_ORIGIN = "https://api.fountain-publisher.com";
const MAX_UPDATE_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 17 * 1024 * 1024;

function base64Url(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function bytesFromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), (character) => character.charCodeAt(0));
}

export async function googleRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${API_ORIGIN}${path}`, { credentials: "include", ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Google request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export function openGoogleSignIn() {
  const width = Math.min(500, screen.availWidth - 24);
  const height = Math.min(700, screen.availHeight - 24);
  return window.open(`${API_ORIGIN}/auth/google/start`, "fountain-publisher-google", `popup,width=${width},height=${height}`);
}

export class CollaborationClient {
  constructor({ onDocument, onPresence, onStatus, onBeforeRemoteUpdate = () => null, onCheckpoint = () => {} }) {
    this.onDocument = onDocument;
    this.onPresence = onPresence;
    this.onStatus = onStatus;
    this.onBeforeRemoteUpdate = onBeforeRemoteUpdate;
    this.onCheckpoint = onCheckpoint;
    this.remoteOrigin = Symbol("remote");
    this.localOrigin = Symbol("local");
    this.reconnectTimer = 0;
    this.checkpointTimer = 0;
    this.closed = true;
    this.syncConflict = false;
    this.syncWaiters = new Set();
  }

  connect({ fileId, documentId, canEdit, pendingContent = null, baselineContent = null }) {
    this.disconnect();
    this.fileId = fileId;
    this.documentId = documentId;
    this.canEdit = canEdit;
    this.closed = false;
    this.synced = false;
    this.applyingInitialSync = false;
    this.pendingContent = canEdit ? pendingContent : null;
    this.baselineContent = baselineContent;
    const doc = this.doc = new Y.Doc();
    const text = this.text = doc.getText("source");
    this.undoManager = new Y.UndoManager(text, { trackedOrigins: new Set([this.localOrigin]), captureTimeout: 500 });
    this.serverVector = null;
    this.needsFlush = false;
    this.nextUpdateId = 0;
    this.deferredMessages = [];
    this.deferredSize = 0;
    this.remoteUpdatesSuspended = false;
    this.reconnectAttempts = 0;
    text.observe((_event, transaction) => {
      if (this.closed || this.doc !== doc) return;
      const value = text.toString();
      if (this.synced && !this.applyingInitialSync) this.onDocument(value, transaction.origin === this.remoteOrigin || transaction.origin === this.undoManager, this.selectionHandle);
      if (transaction.origin === this.remoteOrigin) return;
      this.scheduleCheckpoint();
    });
    doc.on("update", (update, origin) => {
      if (this.closed || this.doc !== doc || origin === this.remoteOrigin) return;
      this.needsFlush = true;
      this.flushUpdates();
    });
    this.openSocket();
  }

  openSocket() {
    if (this.closed) return;
    clearTimeout(this.reconnectTimer);
    const url = new URL(`${API_ORIGIN.replace("https:", "wss:")}/api/collaboration/${this.documentId}`);
    url.searchParams.set("fileId", this.fileId);
    url.searchParams.set("protocol", "2");
    const doc = this.doc;
    const previousSocket = this.socket;
    const socket = this.socket = new WebSocket(url);
    const isCurrent = () => !this.closed && this.doc === doc && this.socket === socket;
    previousSocket?.close();
    this.socketSynced = false;
    this.inFlight = null;
    clearTimeout(this.retryTimer);
    socket.addEventListener("open", () => { if (isCurrent()) this.onStatus("syncing"); });
    socket.addEventListener("message", (event) => { if (isCurrent()) this.receive(event.data); });
    socket.addEventListener("close", (event) => {
      if (!isCurrent()) return;
      this.socket = null;
      this.socketSynced = false;
      this.inFlight = null;
      clearTimeout(this.retryTimer);
      if ([4003, 4009, 4010, 1009].includes(event.code)) {
        this.pause(event.code === 4003 ? "read-only" : "sync-conflict", event.reason || "Collaboration paused. Save a local copy before reopening.");
        return;
      }
      this.reconnectAttempts += 1;
      // A long network outage is not an authorization denial. Retain the Yjs
      // document and offline edits for as long as this tab remains open, while
      // bounding retry traffic instead of discarding mergeable local state.
      this.onStatus("reconnecting", event.reason || (this.reconnectAttempts > 5
        ? "Still unable to join. Local edits remain in this tab; save a local copy and check connectivity or Drive access."
        : `Connection closed (${event.code})`));
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (!this.closed && this.doc === doc && this.socket === null) this.openSocket();
      }, Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempts - 1, 5)) + Math.random() * 1000);
    });
    socket.addEventListener("error", () => { if (isCurrent()) socket.close(); });
  }

  receive(message) {
    if (this.closed || !this.doc) return;
    if (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) return this.pause("sync-conflict", "The shared update is too large. Save a local copy before reopening.");
    let payload;
    try { payload = JSON.parse(message); } catch { return; }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    if (payload.type === "sync" || payload.type === "update") {
      if (this.remoteUpdatesSuspended) {
        this.deferredSize += message.length;
        if (this.deferredSize > MAX_MESSAGE_LENGTH) return this.pause("sync-conflict", "Too many remote edits arrived during composition. Save a local copy before reopening.");
        this.deferredMessages.push(message);
        return;
      }
      if (payload.type === "sync" && payload.protocol !== 2) return this.pause("sync-conflict", "The collaboration server needs updating. Your local text is preserved; save a local copy.");
      const initialSync = payload.type === "sync" && !this.synced;
      if (initialSync && payload.self?.canEdit === false && this.pendingContent !== null && this.pendingContent !== this.baselineContent) {
        return this.pause("read-only", "Editing permission changed before your edits could sync. Your local text is preserved; save a local copy.");
      }
      try {
        this.applyingInitialSync = initialSync;
        const update = bytesFromBase64Url(payload.update);
        if (update.length > MAX_UPDATE_BYTES) throw new Error("Update too large");
        this.selectionHandle = this.onBeforeRemoteUpdate();
        Y.applyUpdate(this.doc, update, this.remoteOrigin);
        if (payload.type === "sync") {
          this.serverVector = bytesFromBase64Url(payload.stateVector);
          Y.decodeStateVector(this.serverVector);
          this.socketSynced = true;
          this.reconnectAttempts = 0;
          if (payload.self?.canEdit === false) this.canEdit = false;
          this.needsFlush = this.canEdit;
        }
        if (initialSync) {
          // Returning to the loaded baseline means there are no local edits to
          // replay; accept any newer room state without overwriting it.
          const pendingContent = this.baselineContent !== null && this.pendingContent === this.baselineContent
            ? null
            : this.pendingContent;
          const roomContent = this.text.toString();
          // A queued editor snapshot is safe to replay only against the exact
          // baseline the editor loaded, or when it already matches the room.
          // Otherwise keep both versions intact for explicit user recovery.
          if (pendingContent !== null && pendingContent !== roomContent && roomContent !== this.baselineContent) {
            this.disconnect();
            this.syncConflict = true;
            this.onStatus("sync-conflict", "The shared document changed before your edits could sync. Your local edits are still in the editor. Save a local copy, then reopen the Drive document to review both versions.");
            return;
          }
          this.synced = true;
          this.pendingContent = null;
          if (pendingContent !== null) this.replace(pendingContent);
          this.onDocument(this.text.toString(), true, this.selectionHandle);
        }
        if (payload.type === "sync") {
          this.flushUpdates();
          this.resolveSyncWaiters();
          this.onStatus(this.canEdit ? "connected" : "read-only");
        }
      } catch { this.onStatus("error"); }
      finally { this.applyingInitialSync = false; this.selectionHandle = null; }
    }
    if (payload.type === "presence") this.onPresence(payload);
    if (payload.type === "checkpoint" && payload.result?.file?.id === this.fileId) {
      this.onCheckpoint(payload.result);
      if (payload.result.content === this.text.toString()) this.onStatus("saved");
    }
    if (payload.type === "checkpoint-status") this.onStatus("save-error", payload.detail);
    if (payload.type === "ack" && this.inFlight?.id === payload.id) {
      let vector;
      try {
        vector = bytesFromBase64Url(payload.stateVector);
        Y.decodeStateVector(vector);
      } catch { return this.pause("sync-conflict", "Invalid synchronization acknowledgment. Save a local copy before reopening."); }
      clearTimeout(this.retryTimer);
      this.inFlight = null;
      this.serverVector = vector;
      this.flushUpdates();
      this.resolveSyncWaiters();
      this.scheduleCheckpoint();
    }
    if (payload.type === "error") this.pause(payload.code === "conflict" ? "sync-conflict" : "read-only", payload.error || "Collaboration paused. Save a local copy.");
  }

  flushUpdates() {
    if (this.closed || !this.canEdit || !this.synced || !this.socketSynced || !this.needsFlush || this.inFlight || this.socket?.readyState !== WebSocket.OPEN) return;
    const update = Y.encodeStateAsUpdate(this.doc, this.serverVector);
    if (update.length > MAX_UPDATE_BYTES) return this.pause("sync-conflict", "The unsent changes are too large. Save a local copy before reopening.");
    this.needsFlush = false;
    if (update.length === 2 && update[0] === 0 && update[1] === 0) { this.resolveSyncWaiters(); return; }
    this.inFlight = { type: "update", protocol: 2, id: ++this.nextUpdateId, update: base64Url(update) };
    this.sendInFlight(0);
  }

  sendInFlight(attempt) {
    if (!this.inFlight || this.socket?.readyState !== WebSocket.OPEN) return;
    const socket = this.socket;
    const pending = this.inFlight;
    socket.send(JSON.stringify(pending));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (this.closed || this.socket !== socket || this.inFlight !== pending) return;
      if (attempt >= 3) socket.close(4000, "Sync acknowledgment timed out");
      else this.sendInFlight(attempt + 1);
    }, 5000);
  }

  suspendRemoteUpdates() { this.remoteUpdatesSuspended = true; }

  resumeRemoteUpdates() {
    this.remoteUpdatesSuspended = false;
    const messages = this.deferredMessages || [];
    this.deferredMessages = [];
    this.deferredSize = 0;
    for (const message of messages) this.receive(message);
  }

  captureSelection({ anchor, head }) {
    if (!this.synced || !this.text) return null;
    const position = (index) => Y.createRelativePositionFromTypeIndex(this.text, Math.max(0, Math.min(this.text.length, index)));
    return { doc: this.doc, anchor: position(anchor), head: position(head) };
  }

  resolveSelection(selection) {
    if (!selection || selection.doc !== this.doc || !this.doc) return null;
    const anchor = Y.createAbsolutePositionFromRelativePosition(selection.anchor, this.doc);
    const head = Y.createAbsolutePositionFromRelativePosition(selection.head, this.doc);
    return anchor && head ? { anchor: anchor.index, head: head.index } : null;
  }

  canUndo() { return !!(this.canEdit && this.synced && this.undoManager?.undoStack.length); }
  canRedo() { return !!(this.canEdit && this.synced && this.undoManager?.redoStack.length); }
  stopCapturing() { this.undoManager?.stopCapturing(); }
  undo() { return this.restoreUndo("undo"); }
  redo() { return this.restoreUndo("redo"); }
  restoreUndo(method) {
    if (!this.canEdit || !this.synced || this.closed) return false;
    this.selectionHandle = this.onBeforeRemoteUpdate();
    try { return !!this.undoManager[method](); }
    finally { this.selectionHandle = null; }
  }

  pause(status, detail) {
    // Keep the editor's external buffer intact. A paused document must be
    // explicitly reopened; automatic reconnect must not replace recovery text.
    this.disconnect();
    this.syncConflict = true;
    this.canEdit = false;
    this.onStatus(status, detail);
  }

  replace(value) {
    if (!this.canEdit || !this.text) return;
    if (!this.synced) {
      this.pendingContent = value;
      return;
    }
    if (value === this.text.toString()) return;
    const current = this.text.toString();
    let start = 0;
    while (start < current.length && start < value.length && current[start] === value[start]) start += 1;
    // Yjs text uses UTF-16 indexes but normalizes split surrogate pairs. Keep
    // minimal replacement boundaries outside a pair (😀 -> 😁 shares its high
    // surrogate), otherwise a normal emoji edit can become replacement glyphs.
    const splitsPair = (text, index) => index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]);
    if (splitsPair(current, start) || splitsPair(value, start)) start -= 1;
    let suffix = 0;
    while (suffix < current.length - start && suffix < value.length - start && current[current.length - 1 - suffix] === value[value.length - 1 - suffix]) suffix += 1;
    if (splitsPair(current, current.length - suffix) || splitsPair(value, value.length - suffix)) suffix -= 1;
    this.doc.transact(() => {
      const removed = current.length - start - suffix;
      const inserted = value.slice(start, value.length - suffix);
      if (removed) this.text.delete(start, removed);
      if (inserted) this.text.insert(start, inserted);
    }, this.localOrigin);
  }

  updatePresence(presence) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "presence", presence }));
  }

  scheduleCheckpoint() {
    if (!this.canEdit) return;
    clearTimeout(this.checkpointTimer);
    this.checkpointTimer = setTimeout(() => {
      if (this.inFlight || this.needsFlush || !this.socketSynced) this.scheduleCheckpoint();
      else this.checkpoint().catch(() => {});
    }, 2000);
  }

  resolveSyncWaiters(error = null) {
    if (!error && (this.inFlight || this.needsFlush || !this.socketSynced)) return;
    for (const waiter of this.syncWaiters) {
      clearTimeout(waiter.timer);
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
    this.syncWaiters.clear();
  }

  waitForSync() {
    if (!this.inFlight && !this.needsFlush && this.socketSynced) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiter.timer = setTimeout(() => {
        this.syncWaiters.delete(waiter);
        reject(new Error("Changes are still syncing. Save a local copy if the connection does not recover."));
      }, 15_000);
      this.syncWaiters.add(waiter);
    });
  }

  async checkpoint() {
    if (this.closed || !this.text || !this.canEdit || !this.synced) return;
    if (this.remoteUpdatesSuspended) throw new Error("Finish composing before saving.");
    const doc = this.doc;
    const fileId = this.fileId;
    const isCurrent = () => !this.closed && this.doc === doc && this.fileId === fileId;
    try {
      await this.waitForSync();
      if (!isCurrent()) throw new Error("The document changed before Save completed.");
      const result = await googleRequest(`/api/collaboration/${encodeURIComponent(this.documentId)}/checkpoint?fileId=${encodeURIComponent(fileId)}`, { method: "POST", body: JSON.stringify({ expectedContent: this.text.toString() }) });
      if (isCurrent()) {
        this.onCheckpoint(result);
        this.onStatus("saved");
      }
      return result;
    } catch (error) {
      if (isCurrent()) {
        if ([401, 403, 412].includes(error.status)) this.pause("sync-conflict", error.message);
        else this.onStatus("save-error", error.message);
      }
      throw error;
    }
  }

  disconnect() {
    this.closed = true;
    this.resolveSyncWaiters(new Error("Collaboration disconnected before Save completed."));
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.checkpointTimer);
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
    this.undoManager?.destroy();
    this.undoManager = null;
    this.doc?.destroy();
    this.doc = null;
    this.text = null;
    this.synced = false;
    this.applyingInitialSync = false;
    this.pendingContent = null;
    this.baselineContent = null;
    this.syncConflict = false;
    this.socketSynced = false;
    this.inFlight = null;
    this.needsFlush = false;
    this.deferredMessages = [];
    this.deferredSize = 0;
    this.remoteUpdatesSuspended = false;
  }
}
