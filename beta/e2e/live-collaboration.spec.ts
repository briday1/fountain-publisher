import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as Y from "yjs";
import * as awarenessEncoding from "lib0/encoding";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import {
  createSharedDocument,
  readSharedDocument,
} from "../src/collaboration/sharedDocument";
import { parseFountain, serializeFountain } from "../src/core/fountain";

const modifier = process.platform === "darwin" ? "Meta" : "Control";
const fileId = "shared-radio-script";
const filename = "Shared Signals.fountain";
const source =
  "Title: Shared Signals\nAuthor: The writing team\n\n" +
  "INT. RADIO STATION - NIGHT\n\n!The radio waits.\n\n!Both writers have a turn.";
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decode = (value: string) => new Uint8Array(Buffer.from(value, "base64"));
type Person = { id: string; name: string; color: string; canEdit: boolean };
const people = {
  alice: { id: "alice", name: "Alice Writer", color: "#2563eb", canEdit: true },
  bob: { id: "bob", name: "Bob Writer", color: "#b45309", canEdit: true },
  viewer: {
    id: "viewer",
    name: "Casey Reader",
    color: "#7c3aed",
    canEdit: false,
  },
};
type Connection = {
  socket: WebSocketRoute;
  person: Person;
  clientId: number;
  connectionId: string;
};
type Update = { type: "update"; id: string | number; update: string };

/** The network boundary is mocked; the document and concurrent updates are real Yjs. */
class SharedDriveRoom {
  readonly document: Y.Doc;
  readonly awareness: Awareness;
  readonly connections = new Set<Connection>();
  readonly blocked = new Set<string>();
  readonly updatesByPerson = new Map<string, number>();
  readonly connectionCounts = new Map<string, number>();
  readonly unexpectedMessages: unknown[] = [];
  private held: { connection: Connection; message: Update }[] | undefined;
  private processed = new Set<string>();
  private sequence = 0;
  revision = 0;
  savedRevision = 0;

  constructor(fountain = source) {
    this.document = createSharedDocument(parseFountain(fountain));
    this.awareness = new Awareness(this.document);
    this.awareness.setLocalState(null);
    this.awareness.on(
      "update",
      (
        {
          added,
          updated,
          removed,
        }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const awareness = encode(
          encodeAwarenessUpdate(this.awareness, [
            ...added,
            ...updated,
            ...removed,
          ]),
        );
        this.broadcast({ type: "presence", awareness }, origin);
      },
    );
  }

  get screenplay() {
    return readSharedDocument(this.document);
  }

  get content() {
    return serializeFountain(this.screenplay);
  }

  get remote() {
    return {
      provider: "google",
      id: fileId,
      etag: `revision-${this.savedRevision}`,
      live: true,
    };
  }

  async install(context: BrowserContext, person: Person) {
    await context.addInitScript(() => {
      Object.defineProperty(window, "showSaveFilePicker", {
        value: undefined,
        configurable: true,
      });
    });
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname.split("/api")[1];
      if (this.blocked.has(person.id)) {
        await route.abort("internetdisconnected");
        return;
      }
      let json: unknown;
      if (path === "/status") {
        json = {
          csrfToken: "collaboration-test-csrf",
          google: { configured: true, connected: true, account: person.name },
          github: { configured: false, connected: false },
        };
      } else if (path === "/google/files") {
        json = {
          items: [
            {
              id: fileId,
              name: filename,
              mimeType: "text/plain",
              shared: true,
              capabilities: { canEdit: person.canEdit },
            },
          ],
        };
      } else if (path === "/google/open") {
        json = { name: filename, content: this.content, remote: this.remote };
      } else if (path === `/collaboration/${fileId}/bootstrap`) {
        json = {
          state: encode(Y.encodeStateAsUpdate(this.document)),
          vector: encode(Y.encodeStateVector(this.document)),
          content: this.content,
          name: filename,
          remote: this.remote,
          self: person,
        };
      } else if (path === `/collaboration/${fileId}/checkpoint`) {
        this.savedRevision = this.revision;
        json = {
          etag: this.remote.etag,
          revision: this.revision,
          content: this.content,
        };
      } else {
        throw new Error(
          `Unexpected collaboration HTTP request: ${route.request().method()} ${path}`,
        );
      }
      await route.fulfill({ json });
    });
    await context.routeWebSocket(
      "**/api/collaboration/**/connect*",
      (socket) => {
        if (this.blocked.has(person.id)) {
          void socket.close({ code: 1012, reason: "Connection interrupted" });
          return;
        }
        const clientId = Number(
          new URL(socket.url()).searchParams.get("clientId"),
        );
        const connection = {
          socket,
          person,
          clientId,
          connectionId: `connection-${++this.sequence}`,
        };
        this.connections.add(connection);
        this.connectionCounts.set(
          person.id,
          (this.connectionCounts.get(person.id) ?? 0) + 1,
        );
        socket.onClose(() => this.remove(connection));
        socket.onMessage((data) => {
          const message = JSON.parse(data.toString());
          if (message.type === "update") {
            this.updatesByPerson.set(
              person.id,
              (this.updatesByPerson.get(person.id) ?? 0) + 1,
            );
            if (!person.canEdit) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  code: "FORBIDDEN",
                  error: "This screenplay is read-only.",
                }),
              );
            } else if (this.held) this.held.push({ connection, message });
            else this.apply(connection, message);
          } else if (message.type === "presence") {
            applyAwarenessUpdate(
              this.awareness,
              decode(message.awareness),
              connection,
            );
          } else if (message.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
          } else this.unexpectedMessages.push(message);
        });
        socket.send(
          JSON.stringify({
            type: "sync",
            state: encode(Y.encodeStateAsUpdate(this.document)),
            vector: encode(Y.encodeStateVector(this.document)),
            self: {
              ...person,
              clientId,
              connectionId: connection.connectionId,
            },
            revision: this.revision,
            savedRevision: this.savedRevision,
          }),
        );
        const present = [...this.awareness.getStates().keys()];
        if (present.length)
          socket.send(
            JSON.stringify({
              type: "presence",
              awareness: encode(encodeAwarenessUpdate(this.awareness, present)),
            }),
          );
      },
    );
  }

  private apply(connection: Connection, message: Update) {
    const key = `${connection.clientId}:${message.id}`;
    if (!this.processed.has(key)) {
      Y.applyUpdate(this.document, decode(message.update));
      this.processed.add(key);
      this.revision++;
      this.broadcast(
        { type: "update", update: message.update, revision: this.revision },
        connection,
      );
    }
    if (this.connections.has(connection))
      connection.socket.send(
        JSON.stringify({
          type: "ack",
          id: message.id,
          vector: encode(Y.encodeStateVector(this.document)),
          revision: this.revision,
        }),
      );
  }

  private broadcast(message: unknown, except?: unknown) {
    for (const connection of this.connections) {
      if (connection !== except)
        connection.socket.send(JSON.stringify(message));
    }
  }

  private remove(connection: Connection) {
    this.connections.delete(connection);
    removeAwarenessStates(this.awareness, [connection.clientId], connection);
  }

  pauseUpdates() {
    this.held = [];
  }

  get pendingAuthors() {
    return [
      ...new Set(this.held?.map(({ connection }) => connection.person.id)),
    ].sort();
  }

  releaseUpdates() {
    const pending = this.held ?? [];
    this.held = undefined;
    for (const { connection, message } of pending)
      this.apply(connection, message);
  }

  cursorAtStart(person: Person) {
    const connection = [...this.connections].find(
      (entry) => entry.person.id === person.id,
    )!;
    const clientId = connection.clientId;
    const state = this.awareness.getStates().get(clientId)!;
    const clock = this.awareness.meta.get(clientId)!.clock + 1;
    const position = Y.relativePositionToJSON(
      Y.createRelativePositionFromTypeIndex(
        this.document.getXmlFragment("script"),
        0,
      ),
    );
    const frame = awarenessEncoding.createEncoder();
    awarenessEncoding.writeVarUint(frame, 1);
    awarenessEncoding.writeVarUint(frame, clientId);
    awarenessEncoding.writeVarUint(frame, clock);
    awarenessEncoding.writeVarString(
      frame,
      JSON.stringify({
        ...state,
        cursor: { anchor: position, head: position },
      }),
    );
    applyAwarenessUpdate(
      this.awareness,
      awarenessEncoding.toUint8Array(frame),
      connection,
    );
  }

  async disconnect(person: Person) {
    this.blocked.add(person.id);
    for (const connection of [...this.connections]) {
      if (connection.person.id !== person.id) continue;
      this.remove(connection);
      await connection.socket.close({
        code: 1012,
        reason: "Connection interrupted",
      });
    }
  }

  destroy() {
    this.awareness.destroy();
    this.document.destroy();
  }
}

const test = base.extend<{
  sharedSource: string;
  room: SharedDriveRoom;
  alice: Page;
  bob: Page;
  viewer: Page;
}>({
  sharedSource: [source, { option: true }],
  room: async ({ sharedSource }, use) => {
    const room = new SharedDriveRoom(sharedSource);
    try {
      await use(room);
    } finally {
      room.destroy();
    }
  },
  alice: async ({ browser, room }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    await room.install(context, people.alice);
    try {
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
  bob: async ({ browser, room }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    await room.install(context, people.bob);
    try {
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
  viewer: async ({ browser, room }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    await room.install(context, people.viewer);
    try {
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Screenplay editor" });
const live = (page: Page) =>
  page.getByRole("status", { name: "Live collaboration", exact: true });
const writing = (page: Page) =>
  editor(page).evaluate((element) =>
    [...element.children]
      .filter((block) => block.matches("p[data-id]"))
      .map((block) => {
        const content = block.cloneNode(true) as HTMLElement;
        content
          .querySelectorAll(".collaboration-cursor")
          .forEach((cursor) => cursor.remove());
        return content.textContent;
      })
      .join("\n"),
  );

async function openShared(page: Page, viaDrive = false) {
  const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
  await page.goto(new URL(viaDrive ? "/" : `/?drive=${fileId}`, baseURL).href);
  await expect(editor(page)).toBeVisible();
  if (viaDrive) {
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page
      .getByRole("button", { name: "Open from Google Drive…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Google Drive", exact: true })
      .getByRole("button", { name: filename, exact: true })
      .click();
  }
  await expect(editor(page)).toContainText("Both writers have a turn.");
  await expect(live(page)).toBeVisible();
}

async function endOfScript(page: Page) {
  await editor(page).click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.press("ArrowRight");
}

async function append(page: Page, text: string) {
  await endOfScript(page);
  await page.keyboard.insertText(text);
}

async function downloadedFountain(page: Page) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Save As…/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.fountain$/);
  return readFile((await file.path())!, "utf8");
}

test("shared Drive writers converge concurrent edits, retain local undo, and keep presence out of Fountain", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice, true);
  await openShared(bob);
  await expect.poll(() => room.connections.size).toBe(2);
  const aliceNode = (await editor(alice).elementHandle())!;
  const bobNode = (await editor(bob).elementHandle())!;
  await endOfScript(alice);
  await endOfScript(bob);
  room.pauseUpdates();
  await Promise.all([
    alice.keyboard.insertText(" Alice adds a signal."),
    bob.keyboard.insertText(" Bob answers the signal."),
  ]);
  await expect.poll(() => room.pendingAuthors).toEqual(["alice", "bob"]);
  room.releaseUpdates();
  for (const page of [alice, bob]) {
    await expect(editor(page)).toContainText("Alice adds a signal.");
    await expect(editor(page)).toContainText("Bob answers the signal.");
  }
  await expect.poll(() => writing(alice)).toBe(await writing(bob));
  await expect(live(alice)).toContainText("Bob Writer");
  await expect(live(bob)).toContainText("Alice Writer");
  await expect(editor(alice).locator(".collaboration-cursor")).toContainText(
    "Bob Writer",
  );
  await expect(editor(bob).locator(".collaboration-cursor")).toContainText(
    "Alice Writer",
  );
  await alice.keyboard.press(`${modifier}+z`);
  for (const page of [alice, bob]) {
    await expect(editor(page)).not.toContainText("Alice adds a signal.");
    await expect(editor(page)).toContainText("Bob answers the signal.");
  }
  expect(
    await aliceNode.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  expect(
    await bobNode.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  const saved = await downloadedFountain(bob);
  expect(saved).toContain("Bob answers the signal.");
  expect(saved).not.toMatch(
    /Alice Writer|Bob Writer|connection-\d+|awareness|clientId/,
  );
  expect(
    parseFountain(saved)
      .blocks.map((block) => block.text)
      .join("\n"),
  ).toBe(room.screenplay.blocks.map((block) => block.text).join("\n"));
  expect(room.unexpectedMessages).toEqual([]);
});

test("disconnected local writing survives reconnection and merges the other writer's changes", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice);
  await openShared(bob);
  await expect.poll(() => room.connections.size).toBe(2);
  const connectionsBefore = room.connectionCounts.get("alice")!;
  await alice.context().setOffline(true);
  await room.disconnect(people.alice);
  await append(alice, " A local line while disconnected.");
  await expect(editor(alice)).toContainText("A local line while disconnected.");
  await append(bob, " A remote line while Alice is away.");
  await expect
    .poll(() => room.content)
    .toContain("A remote line while Alice is away.");
  expect(room.content).not.toContain("A local line while disconnected.");
  room.blocked.delete("alice");
  await alice.context().setOffline(false);
  await expect
    .poll(() => room.connectionCounts.get("alice"), { timeout: 20000 })
    .toBeGreaterThan(connectionsBefore);
  for (const page of [alice, bob]) {
    await expect(editor(page)).toContainText(
      "A local line while disconnected.",
    );
    await expect(editor(page)).toContainText(
      "A remote line while Alice is away.",
    );
  }
  await expect.poll(() => writing(alice)).toBe(await writing(bob));
  expect(room.unexpectedMessages).toEqual([]);
});

test("a read-only shared viewer receives edits without changing the document", async ({
  room,
  alice,
  viewer,
}) => {
  await openShared(alice);
  await openShared(viewer);
  await expect(editor(viewer)).toHaveAttribute("contenteditable", "false");
  await append(alice, " A writer's new line.");
  await expect(editor(viewer)).toContainText("A writer's new line.");
  const before = room.content;
  await editor(viewer).click();
  await viewer.keyboard.insertText(
    "This reader must not change the screenplay.",
  );
  await viewer.keyboard.press("Backspace");
  await expect(editor(viewer)).not.toContainText(
    "This reader must not change the screenplay.",
  );
  expect(room.content).toBe(before);
  expect(room.updatesByPerson.get("viewer") ?? 0).toBe(0);
  expect(room.unexpectedMessages).toEqual([]);
});

test("reopening a shared draft from Workspace reconnects it and keeps both writers synchronized", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice);
  await openShared(bob);
  await append(alice, " Alice wrote before changing documents.");
  await expect(editor(bob)).toContainText(
    "Alice wrote before changing documents.",
  );
  const connectionsBefore = room.connectionCounts.get("alice")!;
  await alice.getByRole("button", { name: "File", exact: true }).click();
  await alice
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await expect(editor(alice)).toHaveText("");
  await expect(live(alice)).toHaveCount(0);
  await expect.poll(() => room.connections.size).toBe(1);
  await alice.keyboard.insertText("A separate local screenplay.");
  await append(bob, " Bob kept writing in the shared draft.");
  await expect
    .poll(() => room.content)
    .toContain("Bob kept writing in the shared draft.");
  await alice.getByRole("button", { name: "Workspace", exact: true }).click();
  const workspace = alice.getByRole("dialog", {
    name: "Your workspace",
    exact: true,
  });
  await workspace
    .getByRole("button", { name: /^Shared Signals\.fountain/ })
    .click();
  await expect(workspace).toBeHidden();
  await expect(live(alice)).toBeVisible();
  await expect
    .poll(() => room.connectionCounts.get("alice"))
    .toBeGreaterThan(connectionsBefore);
  await expect(editor(alice)).toContainText(
    "Alice wrote before changing documents.",
  );
  await expect(editor(alice)).toContainText(
    "Bob kept writing in the shared draft.",
  );
  await expect(editor(alice)).not.toContainText("A separate local screenplay.");
  await append(alice, " Alice is back in the shared room.");
  await expect(editor(bob)).toContainText("Alice is back in the shared room.");
  await expect.poll(() => writing(alice)).toBe(await writing(bob));
  expect(room.unexpectedMessages).toEqual([]);
});

test("offline reload renders the durable shared cache before a stale workspace snapshot and then reconnects", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice);
  await openShared(bob);
  // The app shell stays reachable as it would through its offline cache. Only
  // cloud traffic is blocked here; the preceding test also uses real offline networking.
  const prepareOfflineShell = () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => sessionStorage.getItem("collaboration-test-offline") !== "1",
    });
    const observer = new MutationObserver(() => {
      const editor = document.querySelector(".screenplay-editor");
      if (!editor) return;
      (window as unknown as { firstSharedWriting: string }).firstSharedWriting =
        editor.textContent ?? "";
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
  await alice.addInitScript(prepareOfflineShell);
  await alice.evaluate(prepareOfflineShell);
  await alice.evaluate(() => {
    sessionStorage.setItem("collaboration-test-offline", "1");
    window.dispatchEvent(new Event("offline"));
  });
  await room.disconnect(people.alice);
  await append(alice, " The locally durable sentence survives reload.");
  await expect(
    alice.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  // Simulate a crash after the CRDT outbox persisted but before its render
  // snapshot caught up. Reload must treat the shared cache as authoritative.
  await alice.evaluate(
    async ({ screenplay, id }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("fountain-publisher-workspace-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("documents", "readwrite");
          const store = tx.objectStore("documents");
          const entries = store.getAll();
          entries.onsuccess = () => {
            const record = entries.result.find(
              (entry) => entry.remote?.id === id,
            );
            if (!record) {
              tx.abort();
              return;
            }
            store.put({ ...record, screenplay });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { screenplay: parseFountain(source), id: fileId },
  );
  await append(bob, " Bob wrote while Alice restarted.");
  await expect
    .poll(() => room.content)
    .toContain("Bob wrote while Alice restarted.");
  await alice.reload();
  await expect(editor(alice)).toContainText(
    "The locally durable sentence survives reload.",
  );
  expect(
    await alice.evaluate(
      () =>
        (window as unknown as { firstSharedWriting: string })
          .firstSharedWriting,
    ),
  ).toContain("The locally durable sentence survives reload.");
  await expect(editor(alice)).not.toContainText(
    "Bob wrote while Alice restarted.",
  );
  await append(alice, " Writing also continues after the reload.");
  room.blocked.delete("alice");
  await alice.evaluate(() => {
    sessionStorage.removeItem("collaboration-test-offline");
    window.dispatchEvent(new Event("online"));
  });
  for (const page of [alice, bob]) {
    await expect(editor(page)).toContainText(
      "The locally durable sentence survives reload.",
    );
    await expect(editor(page)).toContainText(
      "Bob wrote while Alice restarted.",
    );
    await expect(editor(page)).toContainText(
      "Writing also continues after the reload.",
    );
  }
  await expect.poll(() => writing(alice)).toBe(await writing(bob));
});

test("independent fields from two already-open title dialogs both survive", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice);
  await openShared(bob);
  for (const page of [alice, bob]) {
    await page.getByRole("button", { name: "Insert", exact: true }).click();
    await page
      .getByRole("button", { name: "Title page…", exact: true })
      .click();
  }
  const aliceTitle = alice.getByRole("dialog", {
    name: "Title page",
    exact: true,
  });
  const bobTitle = bob.getByRole("dialog", { name: "Title page", exact: true });
  await aliceTitle
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("A title from Alice");
  await bobTitle
    .getByRole("textbox", { name: "Author", exact: true })
    .fill("An author from Bob");
  await aliceTitle.getByRole("button", { name: "Save title page" }).click();
  await expect
    .poll(() => room.screenplay.titlePage.title)
    .toBe("A title from Alice");
  await expect(bobTitle).toBeVisible();
  await expect(
    bobTitle.getByRole("textbox", { name: "Author", exact: true }),
  ).toHaveValue("An author from Bob");
  await bobTitle.getByRole("button", { name: "Save title page" }).click();
  for (const page of [alice, bob]) {
    const preview = page.getByRole("region", { name: "Title page preview" });
    await expect(preview).toContainText("A title from Alice");
    await expect(preview).toContainText("An author from Bob");
  }
  expect(room.screenplay.titlePage).toMatchObject({
    title: "A title from Alice",
    author: "An author from Bob",
  });
});

test("title-page changes and beat details reach the other writer and survive Fountain export", async ({
  room,
  alice,
  bob,
}) => {
  await openShared(alice);
  await openShared(bob);
  await alice.getByRole("button", { name: "Insert", exact: true }).click();
  await alice.getByRole("button", { name: "Title page…", exact: true }).click();
  const title = alice.getByRole("dialog", { name: "Title page", exact: true });
  await title
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Two Writers, One Signal");
  await title.getByRole("button", { name: "Save title page" }).click();
  await expect(
    bob.getByRole("region", { name: "Title page preview" }),
  ).toContainText("Two Writers, One Signal");
  await bob.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await bob.getByRole("button", { name: "Add beat", exact: true }).click();
  await bob
    .getByRole("textbox", { name: "Beat 1 title", exact: true })
    .fill("The distant reply");
  await bob
    .getByRole("dialog", { name: "Beat sheet", exact: true })
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await alice.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(
    alice.getByRole("textbox", { name: "Beat 1 title", exact: true }),
  ).toHaveValue("The distant reply");
  await alice
    .getByRole("dialog", { name: "Beat sheet", exact: true })
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const saved = parseFountain(await downloadedFountain(alice));
  expect(saved.titlePage.title).toBe("Two Writers, One Signal");
  expect(saved.metadata.beats.map((beat) => beat.title)).toEqual([
    "The distant reply",
  ]);
  expect(room.screenplay.titlePage.title).toBe(saved.titlePage.title);
  expect(room.unexpectedMessages).toEqual([]);
});

test.describe("long shared screenplay", () => {
  test.use({
    sharedSource:
      source +
      "\n\n" +
      Array.from(
        { length: 1300 },
        (_, index) =>
          `!A quiet moment ${index + 1}. The radio waits for an answer.`,
      ).join("\n\n") +
      "\n\n!At the end of the shared draft.",
  });

  test("native typing remains responsive while a peer receives every edit", async ({
    room,
    alice,
    bob,
  }, testInfo) => {
    await openShared(alice);
    await openShared(bob);
    await endOfScript(bob);
    await endOfScript(alice);
    await expect(live(alice)).toContainText("Bob Writer");
    await expect(live(bob)).toContainText("Alice Writer");
    const paragraphCount = await editor(alice).locator("p").count();
    expect(paragraphCount).toBeGreaterThanOrEqual(1200);
    const firstAlice = (await editor(alice)
      .locator("p")
      .nth(1)
      .elementHandle())!;
    const firstBob = (await editor(bob).locator("p").nth(1).elementHandle())!;
    const retained = await Promise.all(
      [firstAlice, firstBob].map(async (node) => ({
        node,
        id: (await node.getAttribute("data-id"))!,
      })),
    );
    const aliceEditor = (await editor(alice).elementHandle())!;
    const bobEditor = (await editor(bob).elementHandle())!;
    // A valid cursor at the root boundary is a sibling before the first
    // paragraph. It changes child indices without replacing writing nodes.
    room.cursorAtStart(people.bob);
    await expect(
      alice.locator(".screenplay-editor > .collaboration-cursor"),
    ).toHaveText("Bob Writer");
    expect(
      await firstAlice.evaluate(
        (element) =>
          element.isConnected &&
          element !== document.querySelector(".screenplay-editor")?.children[1],
      ),
    ).toBe(true);
    await alice.evaluate(() => {
      const scope = window as unknown as { liveTypingTimes: number[] };
      scope.liveTypingTimes = [];
      let start = 0;
      const target = document.querySelector(".screenplay-editor")!;
      target.addEventListener("keydown", () => {
        start = performance.now();
      });
      target.addEventListener("input", () => {
        const began = start;
        requestAnimationFrame(() =>
          scope.liveTypingTimes.push(performance.now() - began),
        );
      });
    });
    const addition =
      " The writers keep the signal moving without waiting for each other.".repeat(
        3,
      );
    await alice.keyboard.type(addition, { delay: 8 });
    await expect(editor(bob)).toContainText(addition.trim());
    const measurements = await alice.evaluate(() =>
      (window as unknown as { liveTypingTimes: number[] }).liveTypingTimes.sort(
        (a, b) => a - b,
      ),
    );
    expect(measurements.length).toBeGreaterThan(120);
    const typingP95 = measurements[Math.floor(measurements.length * 0.95)];
    await testInfo.attach("live-typing-performance", {
      body: JSON.stringify({
        paragraphs: paragraphCount,
        inputs: measurements.length,
        typingP95,
      }),
      contentType: "application/json",
    });
    console.log(
      `Live shared draft: ${paragraphCount} paragraphs, ${measurements.length} inputs, typing p95 ${typingP95.toFixed(1)} ms`,
    );
    expect(typingP95).toBeLessThan(75);
    for (const node of [aliceEditor, bobEditor]) {
      expect(
        await node.evaluate(
          (element) => element === document.querySelector(".screenplay-editor"),
        ),
      ).toBe(true);
    }
    for (const { node, id } of retained) {
      expect(
        await node.evaluate(
          (element, id) =>
            element.isConnected &&
            element ===
              document.querySelector(
                `.screenplay-editor > p[data-id="${CSS.escape(id)}"]`,
              ),
          id,
        ),
      ).toBe(true);
    }
    await expect.poll(() => writing(alice)).toBe(await writing(bob));
    expect(room.content).toContain(addition.trim());
    expect(room.unexpectedMessages).toEqual([]);
    await alice.screenshot({
      path: testInfo.outputPath("live-shared-writing.png"),
      fullPage: true,
    });
  });
});
