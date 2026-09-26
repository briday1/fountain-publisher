// Isolated acceptance drill. This script has no remote mode and accepts no database arguments.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const beta = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(beta, "work"), { recursive: true });
const root = mkdtempSync(join(beta, "work", "isolated-d1-backup-"));
const dirs = Object.fromEntries(
  ["source", "restored"].map((name) => {
    const dir = join(root, name);
    mkdirSync(dir);
    writeFileSync(
      join(dir, "wrangler.json"),
      JSON.stringify({
        name: "writeshape-isolated-backup-" + name,
        compatibility_date: "2026-09-18",
        d1_databases: [
          {
            binding: "DB",
            database_name: "synthetic-acceptance",
            database_id: "00000000-0000-0000-0000-000000000001",
          },
        ],
      }),
    );
    return [name, dir];
  }),
);
const cli = join(beta, "node_modules/wrangler/bin/wrangler.js");
function run(which, args, { fail = false } = {}) {
  if (args.includes("--remote") || !args.includes("--local"))
    throw new Error("Local-only guard");
  const result = spawnSync(
    process.execPath,
    [cli, ...args, "--config", join(dirs[which], "wrangler.json")],
    {
      cwd: dirs[which],
      encoding: "utf8",
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (fail) {
    assert.notEqual(result.status, 0);
    return result.stderr + result.stdout;
  }
  if (result.status !== 0)
    throw new Error(result.stderr + "\n" + result.stdout);
  return result.stdout;
}
const execute = (which, sql, options) =>
  run(
    which,
    [
      "d1",
      "execute",
      "synthetic-acceptance",
      "--local",
      "--command",
      sql,
      "--json",
    ],
    options,
  );
const schema = [
  "schema",
  "accounts",
  "launch-billing",
  "access-codes",
  "library-history",
  "library-sharing",
  "live-sharing",
]
  .map((name) =>
    readFileSync(join(beta, "cloudflare/writeshape", name + ".sql"), "utf8"),
  )
  .join("\n");
const fixture = `
INSERT INTO accounts(id,email,private_tester,created) VALUES('synthetic-owner','owner@example.test',1,0),('synthetic-reader','reader@example.test',0,0),('synthetic-writer','writer@example.test',0,0);
INSERT INTO account_identities VALUES('google','fixture-owner','synthetic-owner'),('google','fixture-reader','synthetic-reader'),('google','fixture-writer','synthetic-writer');
INSERT INTO items VALUES('11111111-1111-4111-8111-111111111111','synthetic-owner','','Fixture folder','folder',NULL,1,'2026-09-26T00:00:00Z');
INSERT INTO items VALUES('22222222-2222-4222-8222-222222222222','synthetic-owner','11111111-1111-4111-8111-111111111111','Fixture.md','file','# Initial\n\nCafé and a quoted ''word''.',1,'2026-09-26T00:00:00Z');
UPDATE items SET content='# Revised\n\nSecond preserved version.',revision=2,updated='2026-09-26T00:01:00Z' WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE items SET content='# Current\n\nNewest writing.',revision=3,updated='2026-09-26T00:02:00Z' WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO file_shares(id,file_id,owner,recipient_id,recipient_email,created_at) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','synthetic-owner','synthetic-reader','reader@example.test','2026-09-26T00:00:00Z');
INSERT INTO file_edit_shares(id,file_id,owner,recipient_id,recipient_email,created_at,revoked_at) VALUES('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','synthetic-owner','synthetic-writer','writer@example.test','2026-09-26T00:00:00Z','2026-09-26T00:01:00Z');
INSERT INTO file_edit_shares(id,file_id,owner,recipient_id,recipient_email,created_at) VALUES('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','synthetic-owner','synthetic-writer','writer@example.test','2026-09-26T00:02:00Z');
`;
const setup = join(root, "setup.sql");
writeFileSync(setup, schema + "\n" + fixture);
run("source", [
  "d1",
  "execute",
  "synthetic-acceptance",
  "--local",
  "--file",
  setup,
]);
const dump = join(root, "backup.sql");
run("source", [
  "d1",
  "export",
  "synthetic-acceptance",
  "--local",
  "--output",
  dump,
]);
run("restored", [
  "d1",
  "execute",
  "synthetic-acceptance",
  "--local",
  "--file",
  dump,
]);
const tables = [
  "accounts",
  "account_identities",
  "items",
  "file_versions",
  "file_shares",
  "file_edit_shares",
];
const snapshot = (which) =>
  Object.fromEntries(
    tables.map((table) => [
      table,
      JSON.parse(execute(which, `SELECT * FROM ${table} ORDER BY 1,2`))[0]
        .results,
    ]),
  );
const original = snapshot("source"),
  restored = snapshot("restored");
assert.deepEqual(restored, original);
assert.equal(restored.file_versions.length, 2);
assert.equal(restored.items.find((r) => r.kind === "file").revision, 3);
assert.equal(
  restored.file_edit_shares.filter((r) => r.revoked_at === null).length,
  1,
);
assert.match(
  execute("restored", "UPDATE file_versions SET content='forbidden'", {
    fail: true,
  }),
  /IMMUTABLE_FILE_VERSION/,
);
assert.match(
  execute(
    "restored",
    "UPDATE file_edit_shares SET revoked_at=NULL WHERE revoked_at IS NOT NULL",
    { fail: true },
  ),
  /IMMUTABLE_SHARE/,
);
execute(
  "restored",
  "UPDATE items SET content='# After restore',revision=4 WHERE kind='file'",
);
assert.equal(
  JSON.parse(
    execute("restored", "SELECT COUNT(*) AS count FROM file_versions"),
  )[0].results[0].count,
  3,
);
assert.deepEqual(snapshot("source"), original);
const report = {
  scope:
    "Separate synthetic local D1 databases only; no production read, backup or rollback performed",
  root,
  backupSha256: createHash("sha256").update(readFileSync(dump)).digest("hex"),
  tables: Object.fromEntries(
    tables.map((table) => [table, original[table].length]),
  ),
  exactRowsRestored: true,
  immutableHistory: true,
  revokedGrantCannotReactivate: true,
  newSaveArchivesAfterRestore: true,
  sourceUnchanged: true,
};
writeFileSync(join(root, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
