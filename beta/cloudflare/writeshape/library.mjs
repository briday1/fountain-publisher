import { HttpError, json, sameOrigin } from "./http.mjs";
import { premium } from "./accounts.mjs";
const metadata =
  "id,parent,name,kind,revision,updated,length(CAST(COALESCE(content,'') AS BLOB)) AS bytes";
const usageExpression =
  "(COALESCE((SELECT SUM(length(CAST(COALESCE(content,'') AS BLOB))) FROM items WHERE owner=? AND kind='file'),0)+COALESCE((SELECT SUM(length(CAST(content AS BLOB))) FROM file_versions WHERE owner=?),0))";
const fail = (status, message, code) => {
  const e = new HttpError(status, message);
  e.code = code;
  throw e;
};
function setting(env, key) {
  const value = env[key];
  if (value === undefined || value === null || value === "") return null;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new HttpError(
      503,
      "Storage settings need attention. Your writing is unchanged.",
    );
  return Number(value);
}
export function storagePolicy(env) {
  return {
    quotaBytes: setting(env, "STORAGE_QUOTA_BYTES"),
    historyLimit: setting(env, "HISTORY_MAX_VERSIONS"),
  };
}
export async function storageUsage(env, owner) {
  const row = await env.DB.prepare(
    `SELECT
 COALESCE((SELECT SUM(length(CAST(COALESCE(content,'') AS BLOB))) FROM items WHERE owner=? AND kind='file'),0) AS currentBytes,
 COALESCE((SELECT SUM(length(CAST(content AS BLOB))) FROM file_versions WHERE owner=?),0) AS historyBytes,
 (SELECT COUNT(*) FROM items WHERE owner=? AND kind='file') AS fileCount,
 (SELECT COUNT(*) FROM items WHERE owner=? AND kind='folder') AS folderCount,
 (SELECT COUNT(*) FROM file_versions WHERE owner=?) AS versionCount`,
  )
    .bind(owner, owner, owner, owner, owner)
    .first();
  return {
    ...storagePolicy(env),
    ...row,
    usedBytes: row.currentBytes + row.historyBytes,
  };
}
async function ownedFile(env, owner, id) {
  const item = await env.DB.prepare(
    `SELECT ${metadata},content FROM items WHERE owner=? AND id=? AND kind='file'`,
  )
    .bind(owner, id)
    .first();
  if (!item) fail(404, "File not found.", "NOT_FOUND");
  return item;
}
async function ancestors(env, owner, parent) {
  const result = [];
  const seen = new Set();
  while (parent) {
    if (seen.has(parent) || result.length >= 100)
      throw new HttpError(400, "Folder path is unavailable.");
    seen.add(parent);
    const folder = await env.DB.prepare(
      "SELECT id,name,parent FROM items WHERE owner=? AND id=? AND kind='folder'",
    )
      .bind(owner, parent)
      .first();
    if (!folder) fail(404, "Folder not found.", "NOT_FOUND");
    result.unshift({ id: folder.id, name: folder.name });
    parent = folder.parent;
  }
  return result;
}
async function version(env, owner, file, id) {
  if (id === `${file.id}:${file.revision}`)
    return {
      id,
      fileId: file.id,
      revision: file.revision,
      name: file.name,
      content: file.content,
      savedAt: file.updated,
      bytes: file.bytes,
      current: true,
    };
  const saved = await env.DB.prepare(
    "SELECT id,file_id AS fileId,revision,name,content,saved_at AS savedAt,length(CAST(content AS BLOB)) AS bytes FROM file_versions WHERE owner=? AND file_id=? AND id=?",
  )
    .bind(owner, file.id, id)
    .first();
  if (!saved) fail(404, "Version not found.", "NOT_FOUND");
  return { ...saved, current: false };
}
async function body(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 2100000)
    throw new HttpError(413, "File too large (2 MB maximum).");
  const result = JSON.parse(raw);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new HttpError(400, "Invalid file details.");
  return result;
}
async function failedWrite(env, owner, input, policy) {
  if (input.id) {
    const current = await env.DB.prepare(
      "SELECT revision,parent FROM items WHERE owner=? AND id=? AND kind='file'",
    )
      .bind(owner, input.id)
      .first();
    if (
      !current ||
      current.revision !== input.revision ||
      current.parent !== input.parent
    )
      fail(
        409,
        "This file changed in another tab or is no longer available. Open the latest version, or save your draft as a new file.",
        "REVISION_CONFLICT",
      );
  }
  const duplicate = await env.DB.prepare(
    "SELECT id FROM items WHERE owner=? AND parent=? AND name=? COLLATE NOCASE AND id!=?",
  )
    .bind(owner, input.parent, input.name, input.id || "")
    .first();
  if (duplicate)
    fail(
      409,
      "That name already exists in this folder. Choose a different name to keep both files.",
      "NAME_CONFLICT",
    );
  if (input.id && policy.historyLimit !== null) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM file_versions WHERE owner=? AND file_id=?",
    )
      .bind(owner, input.id)
      .first();
    if (row.count >= policy.historyLimit)
      fail(
        409,
        "The configured version retention limit has been reached. No history was deleted. Save as a new file or ask for a higher limit.",
        "HISTORY_LIMIT",
      );
  }
  fail(
    413,
    "There is not enough cloud storage for this save and its version history. Your local draft and cloud versions are unchanged.",
    "QUOTA_EXCEEDED",
  );
}
async function writeFile(env, owner, input) {
  const policy = storagePolicy(env);
  const updated = new Date().toISOString();
  const bytes = new TextEncoder().encode(input.content || "").length;
  if (bytes > 2000000)
    throw new HttpError(413, "File too large (2 MB maximum).");
  let result;
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    if (!Number.isSafeInteger(input.revision) || input.revision < 1)
      throw new HttpError(400, "A file revision is required.");
    // One SQLite statement: quota, expected revision and retention checks serialize with the write.
    // The BEFORE UPDATE trigger archives the old current content in that same transaction.
    // Net storage growth is the full NEW content, because the old content is retained as history.
    result = await env.DB.prepare(
      `UPDATE items SET content=?,name=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=? AND kind='file' AND parent=? AND NOT EXISTS(SELECT 1 FROM items other WHERE other.owner=? AND other.parent=? AND other.name=? COLLATE NOCASE AND other.id!=?) AND (? IS NULL OR ${usageExpression}+?<=?) AND (? IS NULL OR (SELECT COUNT(*) FROM file_versions WHERE owner=? AND file_id=?)<?)`,
    )
      .bind(
        input.content,
        input.name,
        updated,
        id,
        owner,
        input.revision,
        input.parent,
        owner,
        input.parent,
        input.name,
        id,
        policy.quotaBytes,
        owner,
        owner,
        bytes,
        policy.quotaBytes,
        policy.historyLimit,
        owner,
        id,
        policy.historyLimit,
      )
      .run();
  } else {
    result = await env.DB.prepare(
      `INSERT INTO items(id,owner,parent,name,kind,content,revision,updated) SELECT ?,?,?,?,?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM items WHERE owner=? AND parent=? AND name=? COLLATE NOCASE) AND (? IS NULL OR ${usageExpression}+?<=?)`,
    )
      .bind(
        id,
        owner,
        input.parent,
        input.name,
        input.kind,
        input.kind === "file" ? input.content : null,
        updated,
        owner,
        input.parent,
        input.name,
        policy.quotaBytes,
        owner,
        owner,
        bytes,
        policy.quotaBytes,
      )
      .run();
  }
  if (!result.meta.changes) await failedWrite(env, owner, input, policy);
  const item = await env.DB.prepare(
    `SELECT ${metadata} FROM items WHERE owner=? AND id=?`,
  )
    .bind(owner, id)
    .first();
  // Return the exact revision acknowledged by this write, even if a later writer has already saved again.
  return {
    ...item,
    name: input.name,
    revision: input.id ? input.revision + 1 : 1,
    updated,
    bytes,
    versionId: `${id}:${input.id ? input.revision + 1 : 1}`,
  };
}
export async function libraryRoutes(request, env, user) {
  const url = new URL(request.url);
  if (!user) throw new HttpError(401, "Sign in to your WriteShape account.");
  if (request.method !== "GET") {
    sameOrigin(request);
    if (!premium(user))
      throw new HttpError(
        403,
        "Premium is required for cloud saves and restores. You can still open and download your existing scripts.",
      );
  }
  const segments = url.pathname
    .slice("/api/library".length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (request.method === "GET" && !segments.length) {
    const parent = url.searchParams.get("parent") || "";
    const breadcrumbs = await ancestors(env, user.id, parent);
    const items = await env.DB.prepare(
      `SELECT ${metadata} FROM items WHERE owner=? AND parent=? ORDER BY kind DESC,name COLLATE NOCASE`,
    )
      .bind(user.id, parent)
      .all();
    return json({
      items: items.results,
      breadcrumbs,
      usage: await storageUsage(env, user.id),
      canWrite: premium(user),
    });
  }
  if (
    request.method === "GET" &&
    segments[0] === "usage" &&
    segments.length === 1
  )
    return json(await storageUsage(env, user.id));
  if (segments.length && !/^[\w-]{36}$/.test(segments[0]))
    throw new HttpError(404, "File not found.");
  if (request.method === "GET" && segments.length === 1)
    return json(await ownedFile(env, user.id, segments[0]));
  if (
    request.method === "GET" &&
    segments[1] === "versions" &&
    (segments.length === 2 || segments.length === 3)
  ) {
    const file = await ownedFile(env, user.id, segments[0]);
    if (segments.length === 3)
      return json(await version(env, user.id, file, segments[2]));
    const history = await env.DB.prepare(
      `SELECT id||':'||revision AS id,revision,name,updated AS savedAt,length(CAST(COALESCE(content,'') AS BLOB)) AS bytes,1 AS current FROM items WHERE owner=? AND id=?
 UNION ALL SELECT id,revision,name,saved_at AS savedAt,length(CAST(content AS BLOB)) AS bytes,0 AS current FROM file_versions WHERE owner=? AND file_id=? ORDER BY revision DESC`,
    )
      .bind(user.id, file.id, user.id, file.id)
      .all();
    const latest = history.results.find((v) => v.current);
    return json({
      file: {
        ...file,
        content: undefined,
        name: latest.name,
        revision: latest.revision,
        updated: latest.savedAt,
        bytes: latest.bytes,
      },
      versions: history.results.map((v) => ({ ...v, current: !!v.current })),
      historyLimit: storagePolicy(env).historyLimit,
    });
  }
  if (
    request.method === "POST" &&
    segments[1] === "restore" &&
    segments.length === 2
  ) {
    const input = await body(request);
    const file = await ownedFile(env, user.id, segments[0]);
    if (!Number.isSafeInteger(input.revision) || input.revision < 1)
      throw new HttpError(400, "A file revision is required.");
    if (file.revision !== input.revision)
      fail(
        409,
        "This file changed since you opened its history. Refresh versions before restoring.",
        "REVISION_CONFLICT",
      );
    if (typeof input.versionId !== "string")
      throw new HttpError(400, "Choose a version to restore.");
    const source = await version(env, user.id, file, input.versionId);
    if (source.current)
      throw new HttpError(400, "This is already the current version.");
    // Restore content under the current filename; history retains the original filename too.
    return json(
      await writeFile(env, user.id, {
        id: file.id,
        parent: file.parent,
        name: file.name,
        kind: "file",
        revision: input.revision,
        content: source.content,
      }),
    );
  }
  if (request.method !== "POST" || segments.length)
    throw new HttpError(404, "Not found.");
  const input = await body(request);
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 160 ||
    /[\x00-\x1f/\\]/.test(input.name) ||
    !["file", "folder"].includes(input.kind) ||
    typeof input.parent !== "string"
  )
    throw new HttpError(400, "Invalid file details.");
  if (input.kind === "file" && typeof input.content !== "string")
    throw new HttpError(400, "Invalid content.");
  if (input.id && (typeof input.id !== "string" || input.kind !== "file"))
    throw new HttpError(400, "Invalid file details.");
  if (input.parent) await ancestors(env, user.id, input.parent);
  return json(
    await writeFile(env, user.id, {
      ...input,
      name: input.name.trim(),
      content: input.kind === "folder" ? "" : input.content,
    }),
    input.id ? 200 : 201,
  );
}
