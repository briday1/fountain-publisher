// @vitest-environment node
import { expect, it, vi } from "vitest";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import * as Y from "yjs";
import { encodeBytes, decodeBytes } from "../cloudflare/liveRoom";
const origin = "https://writeshape.com";
async function until<T>(
  read: () => T | undefined | Promise<T | undefined>,
): Promise<T> {
  const end = Date.now() + 6000;
  while (Date.now() < end) {
    const result = await read();
    if (result !== undefined) return result;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("WriteShape socket timed out");
}
function insert(doc: Y.Doc, text: string) {
  const vector = Y.encodeStateVector(doc);
  const paragraph = doc
    .getXmlFragment("script")
    .toArray()
    .find(
      (n) => n instanceof Y.XmlElement && n.getAttribute("kind") === "action",
    ) as Y.XmlElement;
  (paragraph.toArray()[0] as Y.XmlText).insert(0, text);
  return encodeBytes(Y.encodeStateAsUpdate(doc, vector));
}
it("WriteShape accounts collaborate on a Book through real D1, Worker and durable sockets; revocation and readers fail closed", async () => {
  const bundle = await build({
    entryPoints: ["cloudflare/writeshape/worker-live.ts"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
  });
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      script: bundle.outputFiles[0].text,
      modules: true,
      compatibilityDate: "2026-09-18",
      d1Databases: ["DB"],
      durableObjects: {
        LIVE_ROOMS: { className: "WriteShapeLiveRoom", useSQLite: true },
      },
      bindings: {
        APP_ORIGIN: origin,
        PUBLIC_LAUNCH: "true",
        LIVE_COLLABORATION: "true",
        BILLING_MODE: "test",
      },
    }),
  );
  const sockets: any[] = [];
  const docs: Y.Doc[] = [];
  try {
    const db = await runtime.getD1Database("DB");
    // SQLite triggers need exec as a complete statement; D1 exec splits newlines.
    for (const name of [
      "schema",
      "accounts",
      "launch-billing",
      "access-codes",
      "library-history",
      "library-sharing",
      "live-sharing",
      "drive",
      "migrations/0001_indefinite_access",
      "migrations/0002_cancellation_feedback",
      "migrations/0003_account_deletion",
      "migrations/0004_code_claim_counts",
      "migrations/0005_rolling_history",
      "migrations/0006_cloud_backup_grace",
    ]) {
      const sql = await readFile(`cloudflare/writeshape/${name}.sql`, "utf8");
      const clean = sql.replace(/--[^\n]*/g, "");
      const triggers =
        clean.match(/CREATE TRIGGER[\s\S]*?END;(?=\s*(?:CREATE|$))/gi) || [];
      const statements = [
        ...clean
          .replace(/CREATE TRIGGER[\s\S]*?END;(?=\s*(?:CREATE|$))/gi, "")
          .split(";")
          .filter((s) => s.trim()),
        ...triggers,
      ];
      for (const statement of statements)
        await db.prepare(statement.trim()).run();
    }
    const tokens: Record<string, string> = {};
    for (const [i, id] of ["owner", "writer", "viewer", "stranger"].entries()) {
      tokens[id] = String(i + 1).repeat(64);
      await db
        .prepare(
          "INSERT INTO accounts(id,email,display_name,private_tester,created) VALUES(?,?,?,?,0)",
        )
        .bind(id, id + "@example.test", id, id === "owner" ? 1 : 0)
        .run();
      await db
        .prepare("INSERT INTO account_identities VALUES(?,?,?)")
        .bind("google", id, id)
        .run();
      await db
        .prepare("INSERT INTO account_sessions VALUES(?,?,?)")
        .bind(
          createHash("sha256").update(tokens[id]).digest("hex"),
          id,
          Math.floor(Date.now() / 1000) + 3600,
        )
        .run();
    }
    const id = crypto.randomUUID(),
      other = crypto.randomUUID(),
      room = "library_" + id;
    for (const file of [id, other])
      await db
        .prepare("INSERT INTO items VALUES(?,?,?,?,?,?,?,?)")
        .bind(
          file,
          "owner",
          "",
          file === id ? "Shared.md" : "Private.md",
          "file",
          "# Book\n\n## One\n\nOriginal paragraph.\n",
          1,
          new Date().toISOString(),
        )
        .run();
    const headers = (user: string) => ({
      Origin: origin,
      Cookie: "__Host-writeshape_session=" + tokens[user],
      "Content-Type": "application/json",
    });
    const call = (user: string, path: string, body?: unknown) =>
      runtime.dispatchFetch(origin + path, {
        method: body === undefined ? "GET" : "POST",
        headers: headers(user),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const grants: Record<string, string> = {};
    for (const [user, role] of [
      ["writer", "read-write"],
      ["viewer", "read-only"],
    ]) {
      const res = await call("owner", `/api/library/${id}/shares`, {
        email: user + "@example.test",
        role,
      });
      expect(res.status, await res.clone().text()).toBe(201);
      grants[user] = ((await res.json()) as any).share.id;
    }
    const path = "/api/collaboration/" + room;
    expect((await call("stranger", path + "/bootstrap", {})).status).toBe(404);
    expect(
      (
        await call(
          "writer",
          "/api/collaboration/library_" + other + "/bootstrap",
          {},
        )
      ).status,
    ).toBe(404);
    const boot = await call("owner", path + "/bootstrap", {});
    expect(boot.status, await boot.clone().text()).toBe(200);
    const initial = (await boot.json()) as any;
    expect(initial.name).toBe("Shared.md");
    const sessions: any[] = [];
    for (const user of ["owner", "writer", "viewer"]) {
      const doc = new Y.Doc();
      docs.push(doc);
      Y.applyUpdate(doc, decodeBytes(initial.state));
      const response = await runtime.dispatchFetch(
        origin + path + "/connect?clientId=" + doc.clientID,
        { headers: { ...headers(user), Upgrade: "websocket" } },
      );
      expect(
        response.status,
        response.status === 101 ? "" : await response.text(),
      ).toBe(101);
      const ws = response.webSocket!;
      sockets.push(ws);
      const messages: any[] = [];
      ws.addEventListener("message", (e) =>
        messages.push(JSON.parse(String(e.data))),
      );
      ws.accept();
      await until(() => messages.find((m) => m.type === "sync"));
      sessions.push({ ws, messages, doc });
    }
    // Independently generated updates from the same starting state must both survive.
    for (const [i, text] of [
      "Owner concurrent. ",
      "Writer concurrent. ",
    ].entries())
      sessions[i].ws.send(
        JSON.stringify({
          type: "update",
          id: i + 1,
          update: insert(docs[i], text),
        }),
      );
    for (let i = 0; i < 2; i++)
      await until(() =>
        sessions[i].messages.find(
          (m: any) => m.type === "ack" && m.id === i + 1,
        ),
      );
    sessions[2].ws.send(
      JSON.stringify({
        type: "update",
        id: 3,
        update: insert(docs[2], "Forbidden viewer. "),
      }),
    );
    await until(() =>
      sessions[2].messages.find((m: any) => m.type === "error"),
    );
    const checkpoint = await call("writer", path + "/checkpoint", {});
    expect(checkpoint.status, await checkpoint.clone().text()).toBe(200);
    let stored = await db
      .prepare("SELECT content FROM items WHERE id=?")
      .bind(id)
      .first<any>();
    expect(stored.content).toContain("# Book");
    expect(stored.content).toContain("Owner concurrent.");
    expect(stored.content).toContain("Writer concurrent.");
    expect(stored.content).not.toContain("Forbidden");
    // Actual LiveClient + IndexedDB implementation over real workerd sockets.
    // Only the browser transport and IndexedDB engine are adapted for Node.
    const { indexedDB, IDBKeyRange } = await import("fake-indexeddb");
    vi.stubGlobal("indexedDB", indexedDB);
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("location", { origin });
    let connectingUser = "owner";
    const bridges: BrowserSocket[] = [];
    class BrowserSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      readyState = 0;
      onmessage?: (event: { data: string }) => void;
      onclose?: (event: { code: number; reason: string }) => void;
      onerror?: () => void;
      peer?: any;
      constructor(url: URL) {
        bridges.push(this);
        const user = connectingUser;
        void runtime
          .dispatchFetch(String(url).replace("wss:", "https:"), {
            headers: { ...headers(user), Upgrade: "websocket" },
          })
          .then((response) => {
            if (response.status !== 101)
              throw new Error("Socket upgrade failed");
            const peer = (this.peer = response.webSocket!);
            sockets.push(peer);
            if (this.readyState === 3) {
              peer.accept();
              peer.close();
              return;
            }
            peer.addEventListener("message", (event: any) => {
              if (this.readyState !== 3)
                this.onmessage?.({ data: String(event.data) });
            });
            peer.addEventListener("close", (event: any) => {
              if (this.readyState === 3) return;
              this.readyState = 3;
              this.onclose?.({ code: event.code, reason: event.reason });
            });
            this.readyState = 1;
            peer.accept();
          })
          .catch(() => {
            this.close();
            this.onerror?.();
          });
      }
      send(data: string) {
        if (this.readyState !== 1) throw new Error("Transport disconnected");
        this.peer.send(data);
      }
      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        this.peer?.close();
        this.onclose?.({ code: 1000, reason: "Synthetic transport loss" });
      }
    }
    vi.stubGlobal("WebSocket", BrowserSocket);
    const { LiveClient } = await import("../src/collaboration/LiveClient");
    const clients: InstanceType<typeof LiveClient>[] = [];
    const phases = new Map<object, string>();
    const connectClient = async (user: string) => {
      const response = await call(user, path + "/bootstrap", {});
      expect(response.status).toBe(200);
      const client = await LiveClient.prepare((await response.json()) as any);
      clients.push(client);
      client.onStatus = (status) => phases.set(client, status.phase);
      connectingUser = user;
      client.start();
      await until(() => (phases.get(client) === "live" ? true : undefined));
      return client;
    };
    try {
      const first = await connectClient("owner");
      const second = await connectClient("writer");
      // Two independent sessions for the same account must receive each other's edits.
      const sameAccount = await connectClient("owner");
      insert(sameAccount.doc, "Second owner session. ");
      await until(() =>
        first.doc
          .getXmlFragment("script")
          .toString()
          .includes("Second owner session.")
          ? true
          : undefined,
      );
      insert(first.doc, "First owner session. ");
      await until(() =>
        sameAccount.doc
          .getXmlFragment("script")
          .toString()
          .includes("First owner session.")
          ? true
          : undefined,
      );
      expect((await call("owner", path + "/checkpoint", {})).status).toBe(200);
      const sameAccountSaved = await db
        .prepare("SELECT content FROM items WHERE id=?")
        .bind(id)
        .first<any>();
      expect(sameAccountSaved.content).toContain("First owner session.");
      expect(sameAccountSaved.content).toContain("Second owner session.");
      await sameAccount.stop();
      sameAccount.destroy();
      bridges[0].close();
      insert(first.doc, "Offline preserved. ");
      // Persist and destroy before retry: this models closing the disconnected tab.
      await first.stop();
      first.destroy();
      insert(second.doc, "Online peer continues. ");
      await until(() => (phases.get(second) === "live" ? true : undefined));
      const restored = await LiveClient.cached(room, "owner");
      expect(restored).toBeDefined();
      clients.push(restored!);
      expect(restored!.doc.getXmlFragment("script").toString()).toContain(
        "Offline preserved.",
      );
      restored!.onStatus = (status) => phases.set(restored!, status.phase);
      connectingUser = "owner";
      restored!.start();
      await until(() =>
        phases.get(restored!) === "live" &&
        second.doc
          .getXmlFragment("script")
          .toString()
          .includes("Offline preserved.") &&
        restored!.doc
          .getXmlFragment("script")
          .toString()
          .includes("Online peer continues.")
          ? true
          : undefined,
      );
      // A second reconnect must not duplicate the persisted outbox update.
      await restored!.stop();
      await restored!.resume();
      await until(() => (phases.get(restored!) === "live" ? true : undefined));
      const saved = await call("owner", path + "/checkpoint", {});
      expect(saved.status).toBe(200);
      const row = await db
        .prepare("SELECT content FROM items WHERE id=?")
        .bind(id)
        .first<any>();
      expect(
        row.content
          .split("<!-- WriteShape metadata")[0]
          .match(/Offline preserved\./g),
      ).toHaveLength(1);
      expect(
        row.content
          .split("<!-- WriteShape metadata")[0]
          .match(/Online peer continues\./g),
      ).toHaveLength(1);
    } finally {
      for (const client of clients) {
        await client.stop();
        client.destroy();
      }
      vi.unstubAllGlobals();
    }
    const revoked = await call(
      "owner",
      `/api/library/${id}/shares/${grants.writer}/revoke`,
      {},
    );
    expect(revoked.status).toBe(200);
    sessions[1].ws.send(
      JSON.stringify({
        type: "update",
        id: 4,
        update: insert(docs[1], "Forbidden revoked. "),
      }),
    );
    await until(() =>
      sessions[1].messages.find(
        (m: any) => m.type === "error" && m.code === "LIVE_ACCESS",
      ),
    );
    expect((await call("writer", path + "/checkpoint", {})).status).toBe(404);
    const recovery = await call("owner", path + "/recovery");
    expect(recovery.status).toBe(200);
    expect(await recovery.text()).not.toContain("Forbidden");
    sessions[0].ws.send(
      JSON.stringify({
        type: "update",
        id: 5,
        update: insert(docs[0], "Durable after close. "),
      }),
    );
    await until(() =>
      sessions[0].messages.find((m: any) => m.type === "ack" && m.id === 5),
    );
    sessions.forEach(({ ws }) => ws.close());
    stored = await until(async () => {
      const row = await db
        .prepare("SELECT content FROM items WHERE id=?")
        .bind(id)
        .first<any>();
      return row.content.includes("Durable after close.") ? row : undefined;
    });
    expect(stored.content).toContain("Writer concurrent.");
    const reopened = await call("owner", path + "/bootstrap", {});
    expect(reopened.status).toBe(200);
    expect(((await reopened.json()) as any).content).toContain(
      "Durable after close.",
    );
    // Ending the room and writing through ordinary cloud autosave must not strand it.
    await db
      .prepare("UPDATE items SET content=?,revision=revision+1 WHERE id=?")
      .bind("# Book\n\n## One\n\nNew ordinary cloud save.\n", id)
      .run();
    const refreshed = await call("owner", path + "/bootstrap", {});
    expect(refreshed.status, await refreshed.clone().text()).toBe(200);
    const refreshedData = (await refreshed.json()) as any;
    expect(refreshedData.content).toContain("New ordinary cloud save.");
    expect(refreshedData.refresh.version).toBeTruthy();
    await db
      .prepare(
        "INSERT INTO maintenance_state VALUES('live_inventory_complete','1')",
      )
      .run();
    const erased = await call("owner", "/api/account/delete", {
      confirmation: "DELETE",
    });
    expect(erased.status, await erased.clone().text()).toBe(200);
    expect(
      await db.prepare("SELECT id FROM accounts WHERE id='owner'").first(),
    ).toBeNull();
    expect(
      await db.prepare("SELECT id FROM items WHERE owner='owner'").first(),
    ).toBeNull();
    expect(
      await db
        .prepare("SELECT id FROM file_versions WHERE owner='owner'")
        .first(),
    ).toBeNull();
    expect(
      await db.prepare("SELECT file_id FROM live_room_registry").first(),
    ).toBeNull();
    expect((await call("writer", path + "/bootstrap", {})).status).toBe(404);
    const rooms = (await runtime.getDurableObjectNamespace(
      "LIVE_ROOMS",
    )) as unknown as {
      idFromName(name: string): unknown;
      get(id: unknown): { fetch(request: Request): Promise<Response> };
    };
    await rooms.get(rooms.idFromName("writeshape-v1:" + room)).fetch(
      new Request("https://room.internal/register-legacy", {
        method: "POST",
      }),
    );
    expect(
      await db
        .prepare("SELECT file_id FROM live_room_registry WHERE file_id=?")
        .bind(room)
        .first(),
    ).toBeNull();
  } finally {
    sockets.forEach((ws) => {
      try {
        ws.close();
      } catch {}
    });
    docs.forEach((doc) => doc.destroy());
    await runtime.dispose();
  }
}, 40000);

it("WriteShape Drive rooms use independent encrypted connections and provider permissions with conditional saves", async () => {
  const fileId = "drive_writeshape_fixture_12345",
    room = "drive_" + fileId;
  const bundle = await build({
    entryPoints: ["cloudflare/writeshape/worker-live.ts"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
  });
  const provider = `let content='# Drive Book\\n\\nOriginal paragraph.\\n',version=1;const denied=new Set();export default {async fetch(request){const url=new URL(request.url);if(url.pathname==='/control/revoke'){denied.add(url.searchParams.get('user'));return Response.json({ok:true});}if(url.pathname==='/control/status')return Response.json({content,version});const user=request.headers.get('authorization')?.replace('Bearer fixture-','');if(!user||denied.has(user))return Response.json({}, {status:403});if(url.pathname.startsWith('/upload/')){if(request.headers.get('if-match')!=='"v'+version+'"')return Response.json({}, {status:412});content=await request.text();version++;return Response.json({id:'${fileId}',etag:'"v'+version+'"'});}if(url.pathname.startsWith('/drive/v2/'))return Response.json({id:'${fileId}',etag:'"v'+version+'"'});if(url.searchParams.get('alt')==='media')return new Response(content);return Response.json({id:'${fileId}',name:'DriveBook.md',mimeType:'text/markdown',capabilities:{canEdit:user!=='viewer'}});}}`;
  const keyBytes = new Uint8Array(32).fill(107),
    keyValue = Buffer.from(keyBytes).toString("base64");
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "writeshape-drive",
          script: bundle.outputFiles[0].text,
          modules: true,
          compatibilityDate: "2026-09-18",
          d1Databases: ["DB"],
          durableObjects: {
            LIVE_ROOMS: { className: "WriteShapeLiveRoom", useSQLite: true },
          },
          outboundService: "google-fixture",
          bindings: {
            APP_ORIGIN: origin,
            PUBLIC_LAUNCH: "true",
            LIVE_COLLABORATION: "true",
            BILLING_MODE: "test",
            DRIVE_TOKEN_KEY: keyValue,
            GOOGLE_CLIENT_ID: "fixture",
            GOOGLE_CLIENT_SECRET: "fixture",
          },
        },
        {
          name: "google-fixture",
          script: provider,
          modules: true,
          compatibilityDate: "2026-09-18",
        },
      ],
    }),
  );
  const sockets: any[] = [];
  const docs: Y.Doc[] = [];
  try {
    const db = await runtime.getD1Database("DB", "writeshape-drive");
    for (const name of [
      "schema",
      "accounts",
      "launch-billing",
      "access-codes",
      "library-history",
      "library-sharing",
      "live-sharing",
      "drive",
      "migrations/0001_indefinite_access",
      "migrations/0002_cancellation_feedback",
      "migrations/0003_account_deletion",
      "migrations/0004_code_claim_counts",
      "migrations/0005_rolling_history",
      "migrations/0006_cloud_backup_grace",
    ]) {
      const sql = (
        await readFile(`cloudflare/writeshape/${name}.sql`, "utf8")
      ).replace(/--[^\n]*/g, "");
      const triggers =
        sql.match(/CREATE TRIGGER[\s\S]*?END;(?=\s*(?:CREATE|$))/gi) || [];
      for (const statement of [
        ...sql
          .replace(/CREATE TRIGGER[\s\S]*?END;(?=\s*(?:CREATE|$))/gi, "")
          .split(";")
          .filter((s) => s.trim()),
        ...triggers,
      ])
        await db.prepare(statement).run();
    }
    const tokens: Record<string, string> = {};
    for (const [i, id] of ["owner", "writer", "viewer"].entries()) {
      tokens[id] = String(i + 1).repeat(64);
      await db
        .prepare(
          "INSERT INTO accounts(id,email,display_name,private_tester,created) VALUES(?,?,?,1,0)",
        )
        .bind(id, id + "@example.test", id)
        .run();
      await db
        .prepare("INSERT INTO account_sessions VALUES(?,?,?)")
        .bind(
          createHash("sha256").update(tokens[id]).digest("hex"),
          id,
          Math.floor(Date.now() / 1000) + 3600,
        )
        .run();
      const key = await crypto.subtle.importKey(
          "raw",
          keyBytes,
          "AES-GCM",
          false,
          ["encrypt"],
        ),
        iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: new TextEncoder().encode(
            "writeshape:drive:tokens:" + id,
          ),
        },
        key,
        new TextEncoder().encode(
          JSON.stringify({
            accessToken: "fixture-" + id,
            refreshToken: "refresh-fixture",
          }),
        ),
      );
      const cipher =
        "v1." +
        Buffer.from(iv).toString("base64") +
        "." +
        Buffer.from(encrypted).toString("base64");
      await db
        .prepare(
          "INSERT INTO drive_connections(account_id,google_subject,email,token_cipher,expires,generation,updated) VALUES(?,?,?,?,?,?,0)",
        )
        .bind(
          id,
          id,
          id + "@example.test",
          cipher,
          Math.floor(Date.now() / 1000) + 3600,
          "fixture-generation",
        )
        .run();
    }
    const headers = (user: string) => ({
      Origin: origin,
      Cookie: "__Host-writeshape_session=" + tokens[user],
      "Content-Type": "application/json",
    });
    const path = origin + "/api/collaboration/" + room;
    const bootstrap = await runtime.dispatchFetch(path + "/bootstrap", {
      method: "POST",
      headers: headers("owner"),
      body: "{}",
    });
    expect(bootstrap.status, await bootstrap.clone().text()).toBe(200);
    const initial = (await bootstrap.json()) as any;
    const sessions: any[] = [];
    for (const user of ["owner", "writer", "viewer"]) {
      const doc = new Y.Doc();
      docs.push(doc);
      Y.applyUpdate(doc, decodeBytes(initial.state));
      const result = await runtime.dispatchFetch(
        path + "/connect?clientId=" + doc.clientID,
        { headers: { ...headers(user), Upgrade: "websocket" } },
      );
      expect(
        result.status,
        result.status === 101 ? "" : await result.text(),
      ).toBe(101);
      const ws = result.webSocket!,
        messages: any[] = [];
      sockets.push(ws);
      ws.addEventListener("message", (e) =>
        messages.push(JSON.parse(String(e.data))),
      );
      ws.accept();
      await until(() => messages.find((m) => m.type === "sync"));
      sessions.push({ ws, messages });
    }
    for (const [i, text] of ["Owner Drive. ", "Peer Drive. "].entries())
      sessions[i].ws.send(
        JSON.stringify({
          type: "update",
          id: i + 1,
          update: insert(docs[i], text),
        }),
      );
    for (let i = 0; i < 2; i++)
      await until(() =>
        sessions[i].messages.find(
          (m: any) => m.type === "ack" && m.id === i + 1,
        ),
      );
    const saved = await runtime.dispatchFetch(path + "/checkpoint", {
      method: "POST",
      headers: headers("writer"),
      body: "{}",
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    const remote = (await runtime.getWorker("google-fixture")) as unknown as {
      fetch(input: string): Promise<Response>;
    };
    const status = (await (
      await remote.fetch("https://provider/control/status")
    ).json()) as any;
    expect(status.content).toContain("# Drive Book");
    expect(status.content).toContain("Owner Drive.");
    expect(status.content).toContain("Peer Drive.");
    sessions[2].ws.send(
      JSON.stringify({
        type: "update",
        id: 3,
        update: insert(docs[2], "Rejected reader. "),
      }),
    );
    await until(() =>
      sessions[2].messages.find((m: any) => m.type === "error"),
    );
    await remote.fetch("https://provider/control/revoke?user=writer");
    sessions[1].ws.send(
      JSON.stringify({
        type: "update",
        id: 4,
        update: insert(docs[1], "Rejected revoked. "),
      }),
    );
    await until(() =>
      sessions[1].messages.find(
        (m: any) => m.type === "error" && m.code === "LIVE_ACCESS",
      ),
    );
    const recovery = await runtime.dispatchFetch(path + "/recovery", {
      headers: headers("owner"),
    });
    expect(recovery.status).toBe(200);
    expect(await recovery.text()).not.toContain("Rejected");
    await db
      .prepare(
        "INSERT INTO maintenance_state VALUES('live_inventory_complete','1')",
      )
      .run();
    const beforeDeletion = await (
      await remote.fetch("https://provider/control/status")
    ).json();
    const erased = await runtime.dispatchFetch(origin + "/api/account/delete", {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    expect(erased.status, await erased.clone().text()).toBe(200);
    expect(
      await (await remote.fetch("https://provider/control/status")).json(),
    ).toEqual(beforeDeletion);
    expect(
      await db
        .prepare(
          "SELECT account_id FROM drive_connections WHERE account_id='owner'",
        )
        .first(),
    ).toBeNull();
    const rooms = (await runtime.getDurableObjectNamespace(
      "LIVE_ROOMS",
    )) as unknown as {
      idFromName(name: string): unknown;
      get(id: unknown): { fetch(request: Request): Promise<Response> };
    };
    await rooms.get(rooms.idFromName("writeshape-v1:" + room)).fetch(
      new Request("https://room.internal/register-legacy", {
        method: "POST",
      }),
    );
    expect(
      await db
        .prepare("SELECT file_id FROM live_room_registry WHERE file_id=?")
        .bind(room)
        .first(),
    ).toBeNull();
  } finally {
    sockets.forEach((ws) => {
      try {
        ws.close();
      } catch {}
    });
    docs.forEach((doc) => doc.destroy());
    await runtime.dispose();
  }
}, 40000);
