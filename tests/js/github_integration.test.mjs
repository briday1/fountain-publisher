import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const htmlPath = join(root, "src/fountain_publisher/web/index.html");
const appPath = join(root, "src/fountain_publisher/web/app.mjs");
const workerPath = join(root, "github-worker/src/index.mjs");
const workerConfigPath = join(root, "github-worker/wrangler.jsonc");
const migrationPath = join(root, "github-worker/migrations/0001_sessions.sql");

test("app exposes a credentialed GitHub repository browser", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /connect-src 'self' https:\/\/api\.fountain-publisher\.com/);
  assert.match(html, /id="github-connect"/);
  assert.match(html, /id="github-dialog"/);
  assert.match(html, /id="github-repository"/);
  assert.match(html, /id="github-branch"/);
  assert.match(html, /id="github-save-here"/);
  assert.match(app, /credentials: "include"/);
  assert.match(app, /window\.open\(url, "fountain-publisher-github"/);
  assert.match(app, /event\.origin !== GITHUB_API/);
  assert.match(app, /confirmDiscard\(\)/);
  assert.match(app, /githubFile: state\.githubFile/);
  assert.match(app, /restore \? cached\.githubFile \|\| null : null/);
  assert.match(app, /sha: body\.sha|JSON\.stringify\(\{ content: source\.value, message:/);
});

test("Worker keeps GitHub OAuth tokens behind an opaque D1 session", async () => {
  await import(pathToFileURL(workerPath));
  const [worker, config, migration] = await Promise.all([
    readFile(workerPath, "utf8"),
    readFile(workerConfigPath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);
  assert.match(config, /api\.fountain-publisher\.com/);
  assert.match(config, /"binding": "DB"/);
  assert.match(config, /GITHUB_CLIENT_SECRET/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS oauth_states/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sessions/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /origin === env\.APP_ORIGIN/);
  assert.match(worker, /DELETE FROM oauth_states WHERE state=\? AND expires_at> \? RETURNING state/);
  assert.match(worker, /\/user\/installations\?per_page=100/);
  assert.match(worker, /\/repositories\?per_page=100/);
  assert.match(worker, /body: JSON\.stringify\(\{ message: body\.message, content: encodeContent\(body\.content\)/);
  assert.doesNotMatch(worker, /access_token[^\n]+localStorage/);
});
