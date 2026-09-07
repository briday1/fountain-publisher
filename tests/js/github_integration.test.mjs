import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const htmlPath = join(root, "src/fountain_publisher/web/index.html");
const appPath = join(root, "src/fountain_publisher/web/app.mjs");
const collaborationPath = join(root, "src/fountain_publisher/web/collaboration.mjs");
const workerPath = join(root, "github-worker/src/index.mjs");
const workerConfigPath = join(root, "github-worker/wrangler.jsonc");
const migrationPath = join(root, "github-worker/migrations/0001_sessions.sql");
const hardeningMigrationPath = join(root, "github-worker/migrations/0002_security_hardening.sql");
const googleMigrationPath = join(root, "github-worker/migrations/0003_google_accounts.sql");

test("app exposes a credentialed GitHub repository browser", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /connect-src 'self' https:\/\/api\.fountain-publisher\.com/);
  assert.match(html, /id="github-connect"/);
  assert.match(html, /id="github-dialog"/);
  assert.match(html, /id="github-repository" type="text" list="github-repositories"/);
  assert.match(html, /id="github-branch" type="text" list="github-branches"/);
  assert.match(html, /id="github-save-details" open/);
  assert.match(html, /id="github-save-here"/);
  assert.match(html, /id="github-save-status" role="status"/);
  assert.match(app, /credentials: "include"/);
  assert.match(app, /window\.open\(url, "fountain-publisher-github"/);
  assert.match(app, /async function waitForGithubPopup\(popup\)/);
  assert.match(app, /while \(popup && !popup\.closed[\s\S]*setTimeout\(resolve, 400\)/);
  assert.match(app, /Cross-Origin-Opener-Policy[\s\S]*refreshGithubSession\(\{ notify: true \}\)[\s\S]*openGithubBrowser\(\)/);
  assert.match(app, /if \(popup\) void waitForGithubPopup\(popup\)/);
  assert.match(app, /event\.origin !== GITHUB_API/);
  assert.match(app, /confirmDiscard\(\)/);
  assert.match(app, /githubFile: state\.githubFile/);
  assert.match(app, /restore \? cached\.githubFile \|\| null : null/);
  assert.match(app, /function renderGithubRepositories\(\)/);
  assert.match(app, /state\.githubBranches\.includes\(\$\("#github-branch"\)\.value\)/);
  assert.match(app, /function renderGithubColumns\(\{ animate = true \} = \{\}\)/);
  assert.match(app, /async function openGithubBrowser\(mode = "open"\)/);
  assert.match(app, /openGithubBrowser\("save"\)/);
  assert.match(app, /state\.githubBrowserMode === "save"/);
  assert.match(app, /Filename selected\. Choose Save here to commit\./);
  assert.match(app, /async function loadGithubFolderPath\(path = ""\)/);
  assert.match(app, /render: finalFolder, animate: false/);
  assert.match(app, /loadGithubFiles\("", \{ remember: !path, render: !path, animate: false \}\)/);
  assert.match(app, /const folder = state\.githubPath/);
  assert.match(app, /repository\.fullName !== state\.githubRepository \|\| branch !== state\.githubBranch/);
  assert.match(app, /entry\.type === "file" && entry\.path === path/);
  assert.match(app, /: existing\?\.sha/);
  assert.match(app, /githubContentPath\(path, repository, branch\)/);
  assert.match(app, /saved\.sha !== result\.sha/);
  assert.match(app, /View commit/);
  assert.match(app, /button\.textContent = "Saving…"/);
  assert.match(app, /localStorage\.setItem\(GITHUB_BROWSER_KEY/);
  assert.match(app, /const location = \{ repository: repository\.fullName, branch, path: state\.githubPath \}/);
  assert.match(app, /loadGithubBranches\(restoreLocation\?\.path \|\| "", restoreLocation\?\.branch \|\| ""\)/);
  assert.match(app, /\[rememberedBranch, repository\.defaultBranch, result\.defaultBranch, "main"\]/);
  assert.match(app, /\$\("#github-save-details"\)\.open = mode === "save" && !matchMedia\("\(max-width: 820px\)"\)\.matches/);
  assert.match(app, /openGithubFile\(entry\.dataset\.githubEntry, entry\)/);
  assert.match(app, /JSON\.stringify\(\{ content, message: target\.message, sha \}\)/);
});

test("Worker encrypts and isolates GitHub sessions with lifecycle controls", async () => {
  await import(pathToFileURL(workerPath));
  const [worker, config, migration, hardening] = await Promise.all([
    readFile(workerPath, "utf8"),
    readFile(workerConfigPath, "utf8"),
    readFile(migrationPath, "utf8"),
    readFile(hardeningMigrationPath, "utf8"),
  ]);
  assert.match(config, /api\.fountain-publisher\.com/);
  assert.match(config, /"binding": "DB"/);
  assert.match(config, /GITHUB_CLIENT_SECRET/);
  assert.match(config, /TOKEN_ENCRYPTION_KEY/);
  assert.match(config, /"crons"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS oauth_states/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sessions/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /origin === env\.APP_ORIGIN/);
  assert.match(hardening, /CREATE TABLE IF NOT EXISTS rate_limits/);
  assert.match(hardening, /DELETE FROM sessions/);
  assert.match(worker, /AES-GCM/);
  assert.match(worker, /encryptToken\(token\.access_token, env\)/);
  assert.match(worker, /decryptToken\(session\.access_token, env\)/);
  assert.match(worker, /binding_hash=\?/);
  assert.match(worker, /secureCookie\(OAUTH_COOKIE, binding, 600\)/);
  assert.match(worker, /async function rateLimited/);
  assert.match(worker, /async function cleanupExpired/);
  assert.match(worker, /async scheduled\(_controller, env, context\)/);
  assert.match(worker, /\/user\/installations\?per_page=100/);
  assert.match(worker, /\/repositories\?per_page=100/);
  assert.match(worker, /defaultBranch: repository\.default_branch/);
  assert.match(worker, /GitHub did not confirm the commit/);
  assert.match(worker, /body: JSON\.stringify\(\{ message: body\.message, content: encodeContent\(body\.content\)/);
  assert.doesNotMatch(worker, /access_token[^\n]+localStorage/);
});

test("Worker establishes hardened Google sessions and limits Drive access", async () => {
  const [worker, config, migration] = await Promise.all([
    readFile(workerPath, "utf8"),
    readFile(workerConfigPath, "utf8"),
    readFile(googleMigrationPath, "utf8"),
  ]);
  assert.match(config, /GOOGLE_CLIENT_ID/);
  assert.match(config, /GOOGLE_CLIENT_SECRET/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS google_oauth_states/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS google_sessions/);
  assert.match(worker, /GOOGLE_SCOPES = "openid email profile https:\/\/www\.googleapis\.com\/auth\/drive\.file"/);
  assert.match(worker, /code_challenge_method: "S256"/);
  assert.match(worker, /DELETE FROM google_oauth_states[\s\S]*RETURNING pkce_verifier/);
  assert.match(worker, /profile\.email_verified !== true/);
  assert.match(worker, /encryptToken\(token\.access_token, env\)/);
  assert.match(worker, /fountainPublisherDocument/);
  assert.match(worker, /\["reader", "writer"\]\.includes\(body\.role\)/);
  assert.match(worker, /permissions\(id,type,role,emailAddress,displayName,photoLink,pendingOwner\)/);
  assert.match(worker, /permissionDeleteMatch/);
  assert.match(worker, /\/api\/google\/picker\/config/);
  assert.match(worker, /adoptMatch/);
  assert.match(worker, /request\.headers\.get\("origin"\) !== env\.APP_ORIGIN/);
  assert.match(config, /"class_name": "CollaborationRoom"/);
  assert.match(worker, /export class CollaborationRoom/);
  assert.match(worker, /Y\.applyUpdate\(this\.document, update\)/);
  assert.match(worker, /authorizedUntil <= Math\.floor\(Date\.now\(\) \/ 1000\)/);
  assert.match(worker, /!identity\?\.canEdit/);
  assert.match(worker, /update\.length > 65_536/);
  assert.ok(worker.indexOf("this.state.acceptWebSocket(server)") < worker.indexOf("server.serializeAttachment(identity)"));
  assert.match(worker, /response\.status !== 101/);
});

test("browser connects Drive documents to resumable Yjs collaboration", async () => {
  const [html, app, collaboration] = await Promise.all([
    readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(collaborationPath, "utf8"),
  ]);
  assert.match(html, /id="google-connect"/);
  assert.match(html, /id="google-drive-dialog"/);
  assert.match(html, /id="google-drive-filter"/);
  assert.match(html, /id="google-share-panel"/);
  assert.match(html, /id="google-permissions"/);
  assert.match(app, /\$\("#google-open"\)\.addEventListener\("click", openGooglePicker\)/);
  assert.match(html, /wss:\/\/api\.fountain-publisher\.com/);
  assert.match(app, /new CollaborationClient/);
  assert.match(app, /function connectDriveCollaboration/);
  assert.match(app, /scheduleCollaborationPresence/);
  assert.match(app, /function renderCollaborationPresence/);
  assert.match(app, /function openGooglePicker/);
  assert.match(collaboration, /import \* as Y/);
  assert.match(collaboration, /Y\.applyUpdate/);
  assert.match(collaboration, /while \(start < current\.length/);
  assert.match(collaboration, /setTimeout\(\(\) => this\.checkpoint\(\), 2000\)/);
  assert.match(html, /id="collaboration-cursors"/);
});
