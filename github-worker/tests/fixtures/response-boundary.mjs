// Synthetic Google/session dependencies; the real API handler and workerd
// Durable Object fetch boundary are under test. Never contacts Google or D1.
import worker from "../../src/index.mjs";

const fileId = "drive_file_123456";
const documentId = "a".repeat(48);
const content = "Synthetic screenplay";

async function sessionEnvironment(bindings) {
  const bytes = new Uint8Array(32).fill(7);
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12).fill(3);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("synthetic-token")));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  const session = {
    google_sub: "synthetic-user", email: "writer@example.invalid",
    access_token: btoa(String.fromCharCode(...packed)), refresh_token: null,
    access_expires_at: Date.now() / 1000 + 3600,
  };
  return {
    ...bindings,
    APP_ORIGIN: "https://fountain-publisher.com",
    TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...bytes)),
    DB: { prepare() { return { bind() { return { first: async () => ({ ...session }) }; } }; } },
  };
}

export class BoundaryRoom {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/checkpoint") {
      const { expectedContent } = await request.json();
      if (expectedContent === "throw") throw new Error("Synthetic private backend exception");
      const status = Number(expectedContent);
      return Response.json(status === 200
        ? { saved: true, content, file: { id: fileId } }
        : { error: "Synthetic Drive conflict" }, { status });
    }
    if (url.pathname === "/recovery") {
      return Response.json({ roomContent: content, driveContent: "Drive version" }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/initialize") return Response.json({ initialized: true });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener("close", () => server.close(1000));
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, bindings, context) {
    Math.random = () => 0.5; // Do not invoke unrelated scheduled DB cleanup.
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (url.hostname !== "www.googleapis.com") throw new Error("Unexpected external request");
      if (url.pathname.startsWith("/drive/v2/")) return Response.json({ id: fileId, etag: '"synthetic-version"' });
      if (url.searchParams.get("alt") === "media") return new Response(content);
      return Response.json({ id: fileId, appProperties: { fountainPublisherDocumentId: documentId }, capabilities: { canEdit: true } });
    };
    return worker.fetch(request, await sessionEnvironment(bindings), context);
  },
};
