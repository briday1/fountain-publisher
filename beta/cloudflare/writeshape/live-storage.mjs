import { resolveAccount, premium } from "./accounts.mjs";
import { accountBilling } from "./billing-mode.mjs";
import { withComplimentaryAccess } from "./access-codes.mjs";
import { driveRoutes } from "./drive.mjs";
import { libraryRoutes } from "./library.mjs";
import { HttpError } from "./http.mjs";
const origin = "https://writeshape.com";
const hash = async (content) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const request = (path, body) =>
  new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function checked(response) {
  const data = await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      data.error || "Live file unavailable.",
    );
  return data;
}
export class WriteShapeLiveStorage {
  constructor(
    env,
    { authenticate = resolveAccount, drive = driveRoutes } = {},
  ) {
    this.env = env;
    this.authenticate = authenticate;
    this.drive = drive;
  }
  async authorize(fileId, credential) {
    if (this.env.LIVE_COLLABORATION !== "true")
      throw new HttpError(403, "Live writing is disabled.");
    const match = fileId.match(/^(drive|library)_([A-Za-z0-9_-]{10,200})$/);
    if (!match) throw new HttpError(400, "Invalid live document.");
    let session;
    try {
      session = JSON.parse(credential);
    } catch {
      throw new HttpError(401, "Sign in again.");
    }
    const account = await withComplimentaryAccess(
      accountBilling(
        await this.authenticate(
          new Request(origin, {
            headers: {
              Cookie: session.cookie || "",
              "Cf-Access-Jwt-Assertion": session.assertion || "",
            },
          }),
          this.env,
        ),
        this.env,
      ),
      this.env,
    );
    if (!account) throw new HttpError(401, "Sign in again.");
    if (
      !this.deletionCheckpoint &&
      (await this.env.DB.prepare(
        "SELECT account_id FROM deleting_accounts WHERE account_id=?",
      )
        .bind(account.id)
        .first())
    )
      throw new HttpError(403, "Account deletion is pending.");
    const [, provider, id] = match;
    let file, canEdit;
    if (provider === "drive") {
      file = await checked(
        await this.drive(
          request("/api/drive/open?id=" + encodeURIComponent(id)),
          this.env,
          account,
        ),
      );
      canEdit = file.canEdit && premium(account);
    } else {
      file = await this.env.DB.prepare(
        "SELECT * FROM items WHERE id=? AND kind='file'",
      )
        .bind(id)
        .first();
      if (!file) throw new HttpError(404, "Live document not found.");
      const owner = await withComplimentaryAccess(
        accountBilling(
          await this.env.DB.prepare("SELECT * FROM accounts WHERE id=?")
            .bind(file.owner)
            .first(),
          this.env,
        ),
        this.env,
      );
      const own = file.owner === account.id;
      const edit = own
        ? null
        : await this.env.DB.prepare(
            "SELECT id FROM file_edit_shares WHERE file_id=? AND recipient_id=? AND owner=? AND revoked_at IS NULL",
          )
            .bind(id, account.id, file.owner)
            .first();
      const read =
        own || edit
          ? null
          : await this.env.DB.prepare(
              "SELECT id FROM file_shares WHERE file_id=? AND recipient_id=? AND owner=? AND revoked_at IS NULL",
            )
              .bind(id, account.id, file.owner)
              .first();
      if (!own && !edit && !read)
        throw new HttpError(404, "Live document not found.");
      canEdit = !!(own || edit) && premium(owner);
      file = { ...file, etag: String(file.revision), canEdit };
    }
    if (!this.deletionCheckpoint)
      await this.env.DB.batch([
        this.env.DB.prepare(
          "INSERT OR IGNORE INTO live_room_registry(file_id) VALUES(?)",
        ).bind(fileId),
        this.env.DB.prepare(
          "INSERT OR IGNORE INTO live_room_members(file_id,account_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=?)",
        ).bind(fileId, account.id, account.id),
      ]);
    return {
      self: {
        id: account.id,
        name: (account.display_name || "Writer").slice(0, 80),
        color: "#3875c7",
        canEdit: !!canEdit,
      },
      file: { ...file, id: fileId },
      cookie: credential,
      token: "",
      account,
      provider,
      originalId: id,
    };
  }
  async snapshot(auth) {
    const fresh = await this.authorize(auth.file.id, auth.cookie);
    return {
      content: fresh.file.content,
      etag: fresh.file.etag,
      hash: await hash(fresh.file.content),
    };
  }
  async save(auth, content, etag) {
    const fresh = await this.authorize(auth.file.id, auth.cookie);
    if (!fresh.self.canEdit)
      throw new HttpError(403, "This live document is read-only.");
    if (fresh.file.etag !== etag)
      throw new HttpError(
        409,
        "The stored file changed outside this live room. Preserve both versions.",
      );
    if (fresh.provider === "drive")
      return (
        await checked(
          await this.drive(
            request("/api/drive/save", { id: fresh.originalId, content, etag }),
            this.env,
            fresh.account,
          ),
        )
      ).etag;
    const owner = await withComplimentaryAccess(
      accountBilling(
        await this.env.DB.prepare("SELECT * FROM accounts WHERE id=?")
          .bind(fresh.file.owner)
          .first(),
        this.env,
      ),
      this.env,
    );
    // libraryRoutes retains quota, immutable history and revision protections. The
    // live writer identity is checked again atomically inside the UPDATE statement.
    const result = await checked(
      await libraryRoutes(
        request("/api/library", {
          id: fresh.originalId,
          name: fresh.file.name,
          parent: fresh.file.parent,
          kind: "file",
          content,
          revision: Number(etag),
        }),
        { ...this.env, LIVE_WRITER_ACCOUNT: fresh.account.id },
        owner,
      ),
    );
    return String(result.revision);
  }
  async verifyOriginalRoom(auth) {
    // Existing Fountain room metadata is not imported silently. The WriteShape
    // namespace only initializes from the provider's version-checked file.
    if (auth.file.legacyLiveRoom)
      throw new HttpError(
        409,
        "Save a separate copy before moving an existing Fountain live room.",
      );
  }
}
