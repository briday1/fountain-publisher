// @ts-ignore JavaScript account router
import { createHandler } from "./worker.mjs";
import { LiveScreenplayRoom, type LiveRoomContext } from "../liveRoom";
import { LiveError } from "../liveDrive";
import type { LiveEnvironment } from "../liveDrive";
import { parseMarkdown, isNovel } from "../../src/core/markdown";
import { parseFountain } from "../../src/core/fountain";
import { serializeDocument } from "../../src/core/documentFormat";
// The adapter is also exercised directly by the Node worker contract tests.
// @ts-ignore JavaScript Worker module
import { WriteShapeLiveStorage } from "./live-storage.mjs";
// @ts-ignore JavaScript Worker module
import * as cloudBackups from "./cloud-backup.mjs";
const { sendBackupNotices, purgeExpiredCloud, freshBackupAccount } = cloudBackups;
// @ts-ignore JavaScript Worker module
import { syncBilling, billingConfigured, stripeClient } from "./billing.mjs";
export class WriteShapeLiveRoom extends LiveScreenplayRoom {
  private accountQueue: Promise<unknown> = Promise.resolve();
  private maintenanceEnv: any;
  private accountStorage: any;
  constructor(context: LiveRoomContext, env: LiveEnvironment) {
    const storage = new WriteShapeLiveStorage(env);
    const wrap =
      (method: string) =>
      async (...args: any[]) => {
        try {
          return await storage[method](...args);
        } catch (error: any) {
          throw new LiveError(
            error.status || 503,
            [401, 403, 404].includes(error.status)
              ? "LIVE_ACCESS"
              : error.status === 409
                ? "LIVE_CONFLICT"
                : "LIVE_UNAVAILABLE",
            error.status
              ? error.message
              : "Live storage is unavailable. Your local writing is preserved.",
          );
        }
      };
    super(context, env, {
      drive: {
        authorize: wrap("authorize"),
        snapshot: wrap("snapshot"),
        save: wrap("save"),
        verifyOriginalRoom: wrap("verifyOriginalRoom"),
      },
      parse: (content, name) =>
        /\.(md|markdown)$/i.test(name)
          ? parseMarkdown(content)
          : parseFountain(content),
      serialize: (doc, name) => {
        if (name && isNovel(doc) !== /\.(md|markdown)$/i.test(name))
          throw new Error(
            "Live document format cannot change. Save a new copy.",
          );
        return serializeDocument(doc);
      },
    });
    this.maintenanceEnv = env;
    this.accountStorage = storage;
  }
  async fetch(request: Request): Promise<Response> {
    const action = new URL(request.url).pathname;
    if (
      request.method === "POST" &&
      ["/backup-notices", "/expire-cloud", "/sync-billing"].includes(action)
    ) {
      const input = (await request.json()) as {
        accountId?: string;
        account_id?: string;
        generation?: string;
      };
      const id = input.accountId || input.account_id;
      if (
        !id ||
        (action !== "/sync-billing" &&
          this.maintenanceEnv.CLOUD_BACKUP_POLICY !== "true")
      )
        return new Response("Forbidden", { status: 403 });
      const task = this.accountQueue.then(async () => {
        if (action === "/sync-billing")
          return Response.json(
            await syncBilling(
              id,
              {
                ...this.maintenanceEnv,
                INTERNAL_BILLING_SYNC: true,
              },
              stripeClient(this.maintenanceEnv),
            ),
          );
        const account = await freshBackupAccount(this.maintenanceEnv, id);
        if (!account) return Response.json({ ok: true });
        // Provider verification prevents a delayed webhook from deleting renewed data.
        if (account.stripe_customer) {
          if (!billingConfigured(this.maintenanceEnv))
            return new Response("Billing verification pending", {
              status: 503,
            });
          await syncBilling(
            id,
            { ...this.maintenanceEnv, INTERNAL_BILLING_SYNC: true },
            stripeClient(this.maintenanceEnv),
          );
        }
        if (action === "/backup-notices")
          await sendBackupNotices(this.maintenanceEnv, id);
        else {
          if (
            this.maintenanceEnv.CLOUD_BACKUP_PURGE !== "true" ||
            !this.maintenanceEnv.CUSTOMER_EMAIL
          )
            return new Response("Not enabled", { status: 403 });
          await purgeExpiredCloud(this.maintenanceEnv, {
            account_id: id,
            generation: input.generation,
          });
        }
        return Response.json({ ok: true });
      });
      this.accountQueue = task.catch(() => {});
      return task;
    }
    if (action === "/account-operation") {
      const path = new URL(request.url).searchParams.get("path") || "";
      if (
        !(path === "/api/account/delete" || path.startsWith("/api/billing/")) ||
        path === "/api/billing/webhook"
      )
        return new Response("Not found", { status: 404 });
      const task = this.accountQueue.then(() =>
        createHandler()(new Request("https://writeshape.com" + path, request), {
          ...this.maintenanceEnv,
          INTERNAL_ACCOUNT_OPERATION: true,
        }),
      );
      this.accountQueue = task.catch(() => {});
      return task;
    }
    // The public router has a strict action allowlist and never forwards either maintenance action.
    if (request.method === "POST" && action === "/register-legacy") {
      const fileId = await this.storedFileId();
      if (fileId)
        await this.maintenanceEnv.DB.prepare(
          "INSERT OR IGNORE INTO live_room_registry(file_id,legacy) VALUES(?,1)",
        )
          .bind(fileId)
          .run();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && action === "/delete-account") {
      const { accountId } = (await request.json()) as { accountId: string };
      if (
        typeof accountId !== "string" ||
        !(await this.maintenanceEnv.DB.prepare(
          "SELECT account_id FROM deleting_accounts WHERE account_id=?",
        )
          .bind(accountId)
          .first())
      )
        return new Response("Forbidden", { status: 403 });
      const fileId = await this.storedFileId();
      if (!fileId) return Response.json({ ok: true });
      const owner = fileId.startsWith("library_")
        ? await this.maintenanceEnv.DB.prepare(
            "SELECT owner FROM items WHERE id=?",
          )
            .bind(fileId.slice(8))
            .first()
        : null;
      const registered = await this.maintenanceEnv.DB.prepare(
        "SELECT file_id FROM live_room_registry WHERE file_id=? AND (legacy=1 OR EXISTS(SELECT 1 FROM live_room_members WHERE file_id=? AND account_id=?))",
      )
        .bind(fileId, fileId, accountId)
        .first();
      if (owner?.owner !== accountId && !registered)
        return new Response("Forbidden", { status: 403 });
      try {
        await this.purgeStoredRoom(owner?.owner !== accountId, (enabled) => {
          this.accountStorage.deletionCheckpoint = enabled;
        });
        await this.maintenanceEnv.DB.batch([
          this.maintenanceEnv.DB.prepare(
            "DELETE FROM live_room_members WHERE file_id=?",
          ).bind(fileId),
          this.maintenanceEnv.DB.prepare(
            "DELETE FROM live_room_registry WHERE file_id=?",
          ).bind(fileId),
        ]);
        return Response.json({ ok: true });
      } catch {
        return new Response("Cleanup pending", { status: 503 });
      } finally {
        this.accountStorage.deletionCheckpoint = false;
      }
    }
    if (request.method === "POST" && action === "/expire-cloud-room") {
      const { accountId } = (await request.json()) as { accountId: string };
      const fileId = await this.storedFileId();
      if (!fileId) return Response.json({ ok: true });
      const permit = await this.maintenanceEnv.DB.prepare(
        "SELECT account_id FROM expiring_cloud_accounts WHERE account_id=?",
      )
        .bind(accountId)
        .first();
      const owner = fileId.startsWith("library_")
        ? await this.maintenanceEnv.DB.prepare(
            "SELECT owner FROM items WHERE id=?",
          )
            .bind(fileId.slice(8))
            .first()
        : null;
      if (!permit || owner?.owner !== accountId)
        return new Response("Forbidden", { status: 403 });
      try {
        await this.purgeStoredRoom(false, (enabled) => {
          this.accountStorage.deletionCheckpoint = enabled;
        });
        return Response.json({ ok: true });
      } finally {
        this.accountStorage.deletionCheckpoint = false;
      }
    }
    return super.fetch(request);
  }
}
