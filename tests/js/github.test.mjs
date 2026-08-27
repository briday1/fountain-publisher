import assert from "node:assert/strict";
import test from "node:test";

import {
  GitHubClient,
  GitHubError,
  GitHubTokenSession,
  branchName,
  decodeContent,
  encodeContent,
  normalizePath,
} from "../../src/fountain_publisher/web/github.mjs";

function response(payload, { status = 200, headers = {} } = {}) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("content encoding preserves Unicode Fountain text", () => {
  const text = "INT. CAFÉ – NIGHT\n\nRENÉE\n🌙";
  assert.equal(decodeContent(encodeContent(text)), text);
});

test("paths and generated branch names are safe", () => {
  assert.equal(normalizePath("//drafts//My Film.fountain/"), "drafts/My Film.fountain");
  assert.equal(branchName("drafts/My Film.fountain", 42), "fountain-publisher/my-film-42");
});

test("token session uses only the supplied session storage and supports forgetting", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const session = new GitHubTokenSession(storage);
  session.set("github_pat_example");
  assert.equal(session.get(), "github_pat_example");
  assert.equal(values.get("fountain-publisher.github-token"), "github_pat_example");
  session.clear();
  assert.equal(session.get(), "");
});

test("client loads user repositories directly and follows pagination", async () => {
  const calls = [];
  const client = new GitHubClient("token", { fetchImpl: async (url) => {
    calls.push(url);
    if (calls.length === 1) return response([{ full_name: "a/one" }], { headers: { link: '<https://api.github.com/page/2>; rel="next"' } });
    return response([{ full_name: "a/two" }]);
  } });
  assert.deepEqual((await client.repositories()).map((repo) => repo.full_name), ["a/one", "a/two"]);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/user\/repos/);
});

test("save sends branch, message, content, and current blob SHA", async () => {
  let request;
  const client = new GitHubClient("token", { fetchImpl: async (...args) => {
    request = args;
    return response({ content: { sha: "new-sha" }, commit: { html_url: "https://github.example/commit" } });
  } });
  await client.save({ owner: "octo", repo: "script", branch: "main", path: "film.fountain", sha: "old-sha", text: "FADE IN:", message: "Revise opening" });
  const body = JSON.parse(request[1].body);
  assert.equal(request[1].method, "PUT");
  assert.deepEqual({ branch: body.branch, message: body.message, sha: body.sha }, { branch: "main", message: "Revise opening", sha: "old-sha" });
  assert.equal(decodeContent(body.content), "FADE IN:");
});

test("API errors identify stale SHA and protected-branch recovery cases", async () => {
  const conflict = new GitHubClient("token", { fetchImpl: async () => response({ message: "sha does not match" }, { status: 409 }) });
  await assert.rejects(() => conflict.save({ owner: "o", repo: "r", branch: "main", path: "a.fountain", sha: "old", text: "", message: "save" }),
    (error) => error instanceof GitHubError && error.isConflict);

  const protectedBranch = new GitHubClient("token", { fetchImpl: async () => response({ message: "Changes must be made through a pull request." }, { status: 403 }) });
  await assert.rejects(() => protectedBranch.save({ owner: "o", repo: "r", branch: "main", path: "a.fountain", sha: "old", text: "", message: "save" }),
    (error) => error instanceof GitHubError && error.isProtectedBranch);
});

test("branch fallback creates a ref before opening a pull request", async () => {
  const requests = [];
  const client = new GitHubClient("token", { fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("/git/ref/")) return response({ object: { sha: "base-sha" } });
    if (url.endsWith("/pulls")) return response({ html_url: "https://github.example/pr/1" });
    return response({});
  } });
  await client.createBranch("o", "r", "main", "draft");
  await client.createPullRequest("o", "r", { title: "Update", body: "Body", head: "draft", base: "main" });
  assert.deepEqual(JSON.parse(requests[1].options.body), { ref: "refs/heads/draft", sha: "base-sha" });
  assert.deepEqual(JSON.parse(requests[2].options.body), { title: "Update", body: "Body", head: "draft", base: "main" });
});
