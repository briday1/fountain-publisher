// Register older persisted live rooms before enabling complete account erasure.
// This never reads document contents or deletes a room.
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(
    new URL("../../beta/wrangler.writeshape.json", import.meta.url),
  ),
);
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Cloudflare deployment credential is required.");
const base = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}`;
async function api(path, method = "GET", body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(
      `Cloudflare maintenance request failed (${response.status}, ${path.split("?")[0]}).`,
    );
  return result;
}
const namespaces = await api(
  "/workers/durable_objects/namespaces?per_page=1000",
);
const namespace = namespaces.result.find(
  (n) => n.script === config.name && n.class === "WriteShapeLiveRoom",
);
if (!namespace)
  throw new Error(
    "WriteShape live namespace was not found; account erasure remains disabled.",
  );
const name = `writeshape-inventory-${randomBytes(6).toString("hex")}`;
const key = randomBytes(32).toString("hex");
const script = `export default { async fetch(request, env) {
  if(request.method !== 'POST' || request.headers.get('Authorization') !== 'Bearer '+env.KEY) return new Response('Not found',{status:404});
  const {ids,complete} = await request.json();
  if(!Array.isArray(ids)||ids.length>25||ids.some(id=>!(/^[a-f0-9]{64}$/.test(id)))) return new Response('Invalid input',{status:400});
  for(const id of ids){ const r=await env.ROOMS.get(env.ROOMS.idFromString(id)).fetch(new Request('https://room.internal/register-legacy',{method:'POST'})); if(!r.ok)return new Response('Index pending',{status:503}); }
  if(complete) await env.DB.prepare("INSERT OR REPLACE INTO maintenance_state(key,value) VALUES('live_inventory_complete','1')").run();
  return Response.json({ok:true});
}}`;
const form = new FormData();
form.set(
  "metadata",
  JSON.stringify({
    main_module: "index.mjs",
    compatibility_date: config.compatibility_date,
    bindings: [
      { name: "KEY", type: "secret_text", text: key },
      {
        name: "ROOMS",
        type: "durable_object_namespace",
        namespace_id: namespace.id,
      },
      { name: "DB", type: "d1", id: config.d1_databases[0].database_id },
    ],
  }),
);
form.set(
  "index.mjs",
  new Blob([script], { type: "application/javascript+module" }),
  "index.mjs",
);
let uploaded = false;
try {
  await api(`/workers/scripts/${name}`, "PUT", form);
  uploaded = true;
  await api(`/workers/scripts/${name}/subdomain`, "POST", { enabled: true });
  const domain = (await api("/workers/subdomain")).result.subdomain;
  const target = `https://${name}.${domain}.workers.dev`;
  async function register(ids, complete = false) {
    let failure;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const r = await fetch(target, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids, complete }),
        });
        if (r.ok && (await r.json()).ok) return;
        failure = new Error(
          `Room indexing failed (${r.status}); account erasure remains disabled.`,
        );
      } catch {
        failure = new Error("Room indexing endpoint is not ready.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw failure;
  }
  let cursor,
    count = 0;
  do {
    const result = await api(
      `/workers/durable_objects/namespaces/${namespace.id}/objects?limit=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
    );
    const ids = result.result.filter((o) => o.hasStoredData).map((o) => o.id);
    for (let i = 0; i < ids.length; i += 25)
      await register(ids.slice(i, i + 25));
    count += ids.length;
    cursor = result.result_info?.cursor;
  } while (cursor);
  await register([], true);
  console.log(
    `Registered ${count} persisted WriteShape live rooms for account cleanup.`,
  );
} finally {
  if (uploaded) await api(`/workers/scripts/${name}`, "DELETE");
}
