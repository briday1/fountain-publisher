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
  }

  connect({ fileId, documentId, canEdit, pendingContent }) {
    this.disconnect();
    this.fileId = fileId;
    this.documentId = documentId;
    this.canEdit = canEdit;
    this.closed = false;
    this.synced = false;
    this.pendingContent = pendingContent;
    this.doc = new Y.Doc();
    this.text = this.doc.getText("source");
    this.text.observe((_event, transaction) => {
      const value = this.text.toString();
      if (this.synced) this.onDocument(value, transaction.origin === this.remoteOrigin);
      if (transaction.origin === this.remoteOrigin) return;
      this.scheduleCheckpoint();
    });
    this.doc.on("update", (update, origin) => {
      if (origin !== this.remoteOrigin && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "update", update: base64Url(update) }));
      }
    });
    this.openSocket();
  }

  openSocket() {
    if (this.closed) return;
    const url = new URL(`${API_ORIGIN.replace("https:", "wss:")}/api/collaboration/${this.documentId}`);
    url.searchParams.set("fileId", this.fileId);
    const socket = this.socket = new WebSocket(url);
    socket.addEventListener("open", () => { if (this.socket === socket) this.onStatus("connected"); });
    socket.addEventListener("message", (event) => { if (this.socket === socket) this.receive(event.data); });
    socket.addEventListener("close", (event) => {
      if (this.closed || this.socket !== socket) return;
      this.onStatus("reconnecting", event.reason || `Connection closed (${event.code})`);
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.openSocket(), 1000 + Math.random() * 2000);
    });
    socket.addEventListener("error", () => socket.close());
  }

  receive(message) {
    let payload;
    try { payload = JSON.parse(message); } catch { return; }
    if (payload.type === "sync" || payload.type === "update") {
      try {
        Y.applyUpdate(this.doc, bytesFromBase64Url(payload.update), this.remoteOrigin);
        if (payload.type === "sync" && !this.synced) {
          this.synced = true;
          if (this.pendingContent !== undefined) this.replace(this.pendingContent);
          this.pendingContent = undefined;
          this.onDocument(this.text.toString(), true);
        }
      } catch { this.onStatus("error"); }
    }
    if (payload.type === "presence") this.onPresence(payload);
    if (payload.type === "error") this.onStatus("read-only");
  }

  replace(value) {
    if (this.text && this.canEdit && !this.synced) { this.pendingContent = value; return; }
    if (!this.canEdit || !this.text || value === this.text.toString()) return;
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
    if (!this.text || !this.canEdit) return;
    const doc = this.doc;
    try {
      await googleRequest(`/api/google/drive/files/${encodeURIComponent(this.fileId)}`, { method: "PUT", body: JSON.stringify({ content: this.text.toString() }) });
      if (this.doc === doc) this.onStatus("saved");
    } catch { if (this.doc === doc) this.onStatus("save-error"); }
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
  }
}
