import * as Y from "./vendor/yjs.mjs";

const API_ORIGIN = "https://api.fountain-publisher.com";

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
  if (!response.ok) throw new Error(result.error || `Google request failed (${response.status})`);
  return result;
}

export function openGoogleSignIn() {
  const width = Math.min(500, screen.availWidth - 24);
  const height = Math.min(700, screen.availHeight - 24);
  return window.open(`${API_ORIGIN}/auth/google/start`, "fountain-publisher-google", `popup,width=${width},height=${height}`);
}

export class CollaborationClient {
  constructor({ onDocument, onPresence, onStatus }) {
    this.onDocument = onDocument;
    this.onPresence = onPresence;
    this.onStatus = onStatus;
    this.remoteOrigin = Symbol("remote");
    this.reconnectTimer = 0;
    this.checkpointTimer = 0;
    this.closed = true;
    this.syncConflict = false;
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
    text.observe((_event, transaction) => {
      if (this.closed || this.doc !== doc) return;
      const value = text.toString();
      if (this.synced && !this.applyingInitialSync) this.onDocument(value, transaction.origin === this.remoteOrigin);
      if (transaction.origin === this.remoteOrigin) return;
      this.scheduleCheckpoint();
    });
    doc.on("update", (update, origin) => {
      // Updates made while disconnected are not retransmitted yet. Reconnect
      // needs a bidirectional state-vector exchange before offline editing is safe.
      if (!this.closed && this.doc === doc && origin !== this.remoteOrigin && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "update", update: base64Url(update) }));
      }
    });
    this.openSocket();
  }

  openSocket() {
    if (this.closed) return;
    clearTimeout(this.reconnectTimer);
    const url = new URL(`${API_ORIGIN.replace("https:", "wss:")}/api/collaboration/${this.documentId}`);
    url.searchParams.set("fileId", this.fileId);
    const doc = this.doc;
    const previousSocket = this.socket;
    const socket = this.socket = new WebSocket(url);
    const isCurrent = () => !this.closed && this.doc === doc && this.socket === socket;
    previousSocket?.close();
    socket.addEventListener("open", () => { if (isCurrent()) this.onStatus("connected"); });
    socket.addEventListener("message", (event) => { if (isCurrent()) this.receive(event.data); });
    socket.addEventListener("close", (event) => {
      if (!isCurrent()) return;
      this.socket = null;
      this.onStatus("reconnecting", event.reason || `Connection closed (${event.code})`);
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (!this.closed && this.doc === doc && this.socket === null) this.openSocket();
      }, 1000 + Math.random() * 2000);
    });
    socket.addEventListener("error", () => { if (isCurrent()) socket.close(); });
  }

  receive(message) {
    if (this.closed || !this.doc) return;
    let payload;
    try { payload = JSON.parse(message); } catch { return; }
    if (payload.type === "sync" || payload.type === "update") {
      const initialSync = payload.type === "sync" && !this.synced;
      try {
        this.applyingInitialSync = initialSync;
        Y.applyUpdate(this.doc, bytesFromBase64Url(payload.update), this.remoteOrigin);
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
          this.onDocument(this.text.toString(), true);
        }
      } catch { this.onStatus("error"); }
      finally { this.applyingInitialSync = false; }
    }
    if (payload.type === "presence") this.onPresence(payload);
    if (payload.type === "error") this.onStatus("read-only");
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
    let suffix = 0;
    while (suffix < current.length - start && suffix < value.length - start && current[current.length - 1 - suffix] === value[value.length - 1 - suffix]) suffix += 1;
    this.doc.transact(() => {
      const removed = current.length - start - suffix;
      const inserted = value.slice(start, value.length - suffix);
      if (removed) this.text.delete(start, removed);
      if (inserted) this.text.insert(start, inserted);
    });
  }

  updatePresence(presence) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "presence", presence }));
  }

  scheduleCheckpoint() {
    if (!this.canEdit) return;
    clearTimeout(this.checkpointTimer);
    this.checkpointTimer = setTimeout(() => this.checkpoint(), 2000);
  }

  async checkpoint() {
    if (this.closed || !this.text || !this.canEdit || !this.synced) return;
    const doc = this.doc;
    const fileId = this.fileId;
    const isCurrent = () => !this.closed && this.doc === doc && this.fileId === fileId;
    try {
      await googleRequest(`/api/google/drive/files/${encodeURIComponent(fileId)}`, { method: "PUT", body: JSON.stringify({ content: this.text.toString() }) });
      if (isCurrent()) this.onStatus("saved");
    } catch { if (isCurrent()) this.onStatus("save-error"); }
  }

  disconnect() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.checkpointTimer);
    this.socket?.close();
    this.socket = null;
    this.doc?.destroy();
    this.doc = null;
    this.text = null;
    this.synced = false;
    this.applyingInitialSync = false;
    this.pendingContent = null;
    this.baselineContent = null;
    this.syncConflict = false;
  }
}
