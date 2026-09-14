// @vitest-environment node
import { expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import * as Y from "yjs";
import { decodeBytes, encodeBytes } from "../cloudflare/liveRoom";

const beta = "https://beta.fountain-publisher.com";
const api = "https://api.fountain-publisher.com/beta/api";
const fileId = "drive_runtime_1234567890";
const initial = "INT. ROOM - DAY\n\nA real runtime.\n";
// Provider behavior is synthetic; Worker/DO storage, sockets, service bindings and alarms are real workerd.
const provider = `
let content=${JSON.stringify(initial)}, etag='"v1"', version=1, bound=false, handshakes=0;
const denied=new Set();
export default {async fetch(request) {
 const url=new URL(request.url), path=url.pathname;
 if(path==='/control/status') return Response.json({content,etag,handshakes});
 if(path==='/control/revoke') {denied.add(url.searchParams.get('user'));return Response.json({ok:true});}
 const user=request.headers.get('cookie')?.match(/fp_google_session=([^;]+)/)?.[1];
 if(path.startsWith('/api/')) {
  if(request.headers.get('origin')!=='https://fountain-publisher.com'||!user||denied.has(user)) return Response.json({}, {status:403});
  if(path==='/api/google/session') return Response.json({account:{id:user,name:user}});
  if(path==='/api/google/picker/config') return Response.json({accessToken:'token-'+user});
  if(path.endsWith('/recovery')) return bound ? Response.json({roomContent:${JSON.stringify(initial)},driveContent:content,file:{id:${JSON.stringify(fileId)}}}) : Response.json({}, {status:409});
  if(path.startsWith('/api/collaboration/')) {
   if(request.headers.get('upgrade')!=='websocket'||url.searchParams.get('protocol')!=='2') return Response.json({}, {status:400});
   handshakes++;bound=true;const pair=new WebSocketPair();pair[1].accept();pair[1].addEventListener('close',()=>pair[1].close());return new Response(null,{status:101,webSocket:pair[0]});
  }
 }
 const token=request.headers.get('authorization')?.replace('Bearer token-','');
 if(!token||denied.has(token)) return Response.json({}, {status:403});
 if(path.startsWith('/upload/')) {if(request.headers.get('if-match')!==etag)return Response.json({}, {status:412});content=await request.text();etag='"v'+(++version)+'"';return Response.json({id:${JSON.stringify(fileId)},etag});}
 if(path.startsWith('/drive/v2/')) return Response.json({id:${JSON.stringify(fileId)},etag});
 if(url.searchParams.get('alt')==='media') return new Response(content);
 if(path.startsWith('/drive/v3/')) return Response.json({id:${JSON.stringify(fileId)},name:'Runtime.fountain',mimeType:'text/plain',appProperties:{fountainPublisherDocumentId:'${"a".repeat(48)}'},capabilities:{canEdit:token!=='viewer'}});
 return Response.json({error:'Unknown synthetic endpoint'},{status:404});
}};
`;
function insertion(doc: Y.Doc, value: string) {
  const before = Y.encodeStateVector(doc);
  const paragraph = doc
    .getXmlFragment("script")
    .toArray()
    .find(
      (node) =>
        node instanceof Y.XmlElement && node.getAttribute("kind") === "action",
    ) as Y.XmlElement;
  (paragraph.toArray()[0] as Y.XmlText).insert(0, value);
  return encodeBytes(Y.encodeStateAsUpdate(doc, before));
}
async function until<T>(
  read: () => T | undefined | Promise<T | undefined>,
): Promise<T> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for real Worker socket event");
}
it("runs structured collaboration through real Worker service/DO boundaries and durable checkpoints", async () => {
  const bundle = await build({
    entryPoints: ["cloudflare/beta.ts"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
  });
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "beta-runtime",
          script: bundle.outputFiles[0].text,
          modules: true,
          compatibilityDate: "2026-09-14",
          durableObjects: {
            LIVE_ROOMS: { className: "LiveScreenplayRoom", useSQLite: true },
          },
          serviceBindings: { SHARED_API: "synthetic-provider" },
          outboundService: "synthetic-provider",
          bindings: {
            BETA_ORIGIN: beta,
            API_ORIGIN: "https://api.fountain-publisher.com",
            SHARED_ORIGIN: "https://fountain-publisher.com",
          },
        },
        {
          name: "synthetic-provider",
          script: provider,
          modules: true,
          compatibilityDate: "2026-09-14",
        },
      ],
    }),
  );
  const headers = (user: string) => ({
    Origin: beta,
    Cookie: `fp_google_session=${user}; fp_beta_csrf=nonce`,
    "X-CSRF-Token": "nonce",
  });
  try {
    const response = await runtime.dispatchFetch(
      `${api}/collaboration/${fileId}/bootstrap`,
      { method: "POST", headers: headers("alice"), body: "{}" },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    const bootstrap = (await response.json()) as {
      state: string;
      content: string;
    };
    const docs = [new Y.Doc(), new Y.Doc()];
    docs.forEach((doc) => Y.applyUpdate(doc, decodeBytes(bootstrap.state)));
    const sessions: {
      socket: { send(message: string): void; close(): void };
      messages: Record<string, unknown>[];
    }[] = [];
    for (const [index, user] of ["alice", "bob"].entries()) {
      const connected = await runtime.dispatchFetch(
        `${api}/collaboration/${fileId}/connect?clientId=${docs[index].clientID}`,
        { headers: { ...headers(user), Upgrade: "websocket" } },
      );
      expect(
        connected.status,
        connected.status === 101 ? "" : await connected.text(),
      ).toBe(101);
      const socket = connected.webSocket!;
      const messages: Record<string, unknown>[] = [];
      socket.addEventListener("message", (event) =>
        messages.push(JSON.parse(String(event.data))),
      );
      socket.accept();
      await until(() => messages.find((message) => message.type === "sync"));
      sessions.push({ socket, messages });
    }
    sessions[0].socket.send(
      JSON.stringify({
        type: "update",
        id: 1,
        update: insertion(docs[0], "Before sleep. "),
      }),
    );
    await until(() =>
      sessions[0].messages.find((message) => message.type === "ack"),
    );
    const received = await until(() =>
      sessions[1].messages.find((message) => message.type === "update"),
    );
    Y.applyUpdate(docs[1], decodeBytes(received.update));
    sessions[1].socket.send(
      JSON.stringify({
        type: "update",
        id: 2,
        update: insertion(docs[1], "After syncing. "),
      }),
    );
    await until(() =>
      sessions[1].messages.find(
        (message) => message.type === "ack" && message.id === 2,
      ),
    );
    const saved = await runtime.dispatchFetch(
      `${api}/collaboration/${fileId}/checkpoint`,
      {
        method: "POST",
        headers: headers("bob"),
        body: JSON.stringify({
          vector: encodeBytes(Y.encodeStateVector(docs[1])),
        }),
      },
    );
    expect(saved.status, await saved.clone().text()).toBe(200);
    expect(saved.headers.get("access-control-allow-origin")).toBe(beta);
    const result = (await saved.json()) as {
      content: string;
      remote: { live: boolean };
    };
    expect(result.content).toContain("Before sleep.");
    expect(result.content).toContain("After syncing.");
    expect(result.remote.live).toBe(true);
    const providerWorker = (await runtime.getWorker(
      "synthetic-provider",
    )) as unknown as { fetch(input: string): Promise<Response> };
    const status = (await (
      await providerWorker.fetch("https://provider/control/status")
    ).json()) as { content: string; handshakes: number };
    expect(status.content).toBe(result.content);
    expect(status.handshakes).toBe(1);
    const stale = await runtime.dispatchFetch(`${api}/google/save`, {
      method: "POST",
      headers: headers("alice"),
      body: JSON.stringify({
        id: fileId,
        content: bootstrap.content,
        etag: '"v1"',
      }),
    });
    expect(stale.status).toBe(409);
    await providerWorker.fetch("https://provider/control/revoke?user=alice");
    sessions[0].socket.send(
      JSON.stringify({
        type: "update",
        id: 3,
        update: insertion(docs[0], "Rejected. "),
      }),
    );
    await until(() =>
      sessions[0].messages.find(
        (message) => message.type === "error" && message.code === "LIVE_ACCESS",
      ),
    );
    const recovery = await runtime.dispatchFetch(
      `${api}/collaboration/${fileId}/recovery`,
      { headers: headers("bob") },
    );
    expect(recovery.status).toBe(200);
    expect(await recovery.text()).not.toContain("Rejected.");
    sessions[1].socket.send(
      JSON.stringify({
        type: "update",
        id: 4,
        update: insertion(docs[1], "Last browser closes. "),
      }),
    );
    await until(() =>
      sessions[1].messages.find(
        (message) => message.type === "ack" && message.id === 4,
      ),
    );
    sessions.forEach(({ socket }) => socket.close());
    const automatic = await until(async () => {
      const value = (await (
        await providerWorker.fetch("https://provider/control/status")
      ).json()) as { content: string };
      return value.content.includes("Last browser closes.") ? value : undefined;
    });
    expect(automatic.content).toContain("Before sleep.");
    expect(automatic.content).toContain("After syncing.");
    docs.forEach((doc) => doc.destroy());
  } finally {
    await runtime.dispose();
  }
}, 30000);
