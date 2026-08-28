const API_ROOT = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message, { status = 0, response = null } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.response = response;
    this.isConflict = status === 409 || status === 422;
    this.isProtectedBranch = status === 403 && /protected branch|protected_branch|changes must be made through a pull request/i.test(message);
  }
}

export function encodeContent(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeContent(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function normalizePath(path) {
  return String(path || "").trim().replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

function encodePath(path) {
  return normalizePath(path).split("/").map(encodeURIComponent).join("/");
}

export function branchName(path, now = Date.now()) {
  const stem = normalizePath(path).split("/").pop()?.replace(/\.[^.]+$/, "") || "screenplay";
  const safe = stem.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "screenplay";
  return `fountain-publisher/${safe}-${now}`;
}

function nextLink(header) {
  return header?.split(",").find((part) => /rel="next"/.test(part))?.match(/<([^>]+)>/)?.[1] || null;
}

export class GitHubClient {
  constructor(token, { fetchImpl = fetch, apiRoot = API_ROOT } = {}) {
    if (!token) throw new Error("A GitHub access token is required");
    this.token = token;
    this.fetch = fetchImpl;
    this.apiRoot = apiRoot.replace(/\/$/, "");
  }

  async request(path, options = {}) {
    const url = /^https?:/.test(path) ? path : `${this.apiRoot}${path}`;
    const response = await this.fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: ["Bearer", this.token].join(" "),
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.message || `${response.status} ${response.statusText}`;
      throw new GitHubError(detail, { status: response.status, response: payload });
    }
    return { payload, response };
  }

  async pages(path) {
    const items = [];
    let next = path;
    while (next) {
      const { payload, response } = await this.request(next);
      items.push(...(Array.isArray(payload) ? payload : payload?.repositories || []));
      next = nextLink(response.headers.get("link"));
    }
    return items;
  }

  async repositories() {
    return this.pages("/user/repos?sort=updated&per_page=100");
  }

  async branches(owner, repo) {
    return this.pages(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
  }

  async contents(owner, repo, path = "", branch = "") {
    const clean = encodePath(path);
    const suffix = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    return (await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${clean}${suffix}`)).payload;
  }

  async file(owner, repo, path, branch) {
    const payload = await this.contents(owner, repo, path, branch);
    if (Array.isArray(payload) || payload?.type !== "file") throw new GitHubError("The selected path is not a file");
    return { text: decodeContent(payload.content), sha: payload.sha, htmlUrl: payload.html_url };
  }

  async files(owner, repo, branch) {
    const tree = (await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`)).payload;
    if (tree.truncated) throw new GitHubError("This repository is too large to browse recursively. Use Save As and enter a path.");
    return tree.tree.filter((item) => item.type === "blob" && /\.(fountain|txt)$/i.test(item.path));
  }

  async save({ owner, repo, branch, path, sha, text, message }) {
    const clean = normalizePath(path);
    if (!clean) throw new Error("A repository path is required");
    const body = { branch, message, content: encodeContent(text) };
    if (sha) body.sha = sha;
    return (await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(clean)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })).payload;
  }

  async createBranch(owner, repo, fromBranch, newBranch) {
    const base = (await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(fromBranch)}`)).payload;
    await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: base.object.sha }),
    });
  }

  async createPullRequest(owner, repo, { title, body, head, base }) {
    return (await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title, body, head, base }),
    })).payload;
  }
}

export class GitHubOAuthSession {
  constructor(storage, key = "fountain-publisher.github-oauth") {
    this.storage = storage;
    this.key = key;
    this.memoryToken = "";
  }

  get() {
    if (this.memoryToken) return this.memoryToken;
    try { return this.storage?.getItem(this.key) || ""; }
    catch { return ""; }
  }

  set(token) {
    this.memoryToken = String(token || "").trim();
    if (!this.memoryToken) throw new Error("GitHub did not return an access token");
    try { this.storage?.setItem(this.key, this.memoryToken); }
    catch { /* Memory-only use remains available when session storage is blocked. */ }
    return this.memoryToken;
  }

  clear() {
    this.memoryToken = "";
    try { this.storage?.removeItem(this.key); }
    catch { /* Nothing else to clear. */ }
  }
}
