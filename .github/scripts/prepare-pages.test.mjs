import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { preparePages } from "./prepare-pages.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "fp-pages-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const build = join(directory, "build");
  const published = join(directory, "published");
  async function put(root, path, content = path) {
    const fullPath = join(root, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
  for (const [path, content] of [
    ["index.html", "current editor"],
    ["sw.js", "current offline worker"],
    ["service-worker.js", "current offline worker"],
    ["assets/current.js", "current app"],
    ["offline-shell-current.html", "current offline shell"],
    ["THIRD_PARTY_NOTICES.txt", "current dependency notices"],
    ["licenses.html", "current license page"],
    ["previews/beta/index.html", "forward to production"],
    ["previews/beta/redirect.js", "keep query and fragment"],
    ["previews/beta/sw.js", "forward future navigation"],
  ])
    await put(build, path, content);
  return { build, published, put };
}

async function tree(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const child of await tree(join(directory, entry.name)))
        paths.push(`${entry.name}/${child}`);
    } else paths.push(entry.name);
  }
  return paths.sort();
}

test("publication removes obsolete compilers and retires preview editors without breaking current assets or migration URLs", async (t) => {
  const { build, published, put } = await fixture(t);
  for (const prefix of ["", "previews/beta/", "previews/pr-86/"]) {
    for (const file of [
      "app.mjs",
      "compiler-runtime.mjs",
      "pyodide/pyodide.asm.wasm",
      "vendor/screenplain.whl",
      "fonts/CourierPrime-Regular.ttf",
      "styles.css",
      "index.html",
      "service-worker.js",
      "THIRD_PARTY_NOTICES.md",
    ])
      await put(published, prefix + file, "old runtime");
  }
  await put(published, "previews/beta/offline-shell-old.html");
  await put(published, "previews/beta/assets/previous-beta.js");
  await put(published, "assets/previous.js");
  await put(published, "offline-shell-previous.html");
  await put(published, "CNAME", "fountain-publisher.com\n");
  await put(published, ".git/config", "git metadata");
  await put(published, "previews/custom/resource.txt", "unrelated file");

  await preparePages(build, published);
  const paths = await tree(published);
  assert.ok(paths.includes("assets/previous.js"));
  assert.ok(paths.includes("assets/current.js"));
  assert.equal(
    await readFile(join(published, "licenses.html"), "utf8"),
    "current license page",
  );
  assert.equal(
    await readFile(join(published, "THIRD_PARTY_NOTICES.txt"), "utf8"),
    "current dependency notices",
  );
  assert.ok(paths.includes("offline-shell-previous.html"));
  assert.ok(paths.includes("previews/beta/assets/previous-beta.js"));
  assert.ok(!paths.includes("previews/beta/offline-shell-old.html"));
  assert.ok(
    !paths.some((path) =>
      /(?:pyodide|vendor|compiler-runtime|app\.mjs|styles\.css|THIRD_PARTY_NOTICES\.md)/.test(
        path,
      ),
    ),
  );
  assert.equal(
    await readFile(join(published, ".git/config"), "utf8"),
    "git metadata",
  );
  assert.equal(
    await readFile(join(published, "previews/custom/resource.txt"), "utf8"),
    "unrelated file",
  );
  assert.equal(
    await readFile(join(published, "index.html"), "utf8"),
    "current editor",
  );
  for (const name of ["sw.js", "service-worker.js"]) {
    assert.equal(
      await readFile(join(published, name), "utf8"),
      "current offline worker",
    );
    for (const preview of ["beta", "pr-86"]) {
      assert.equal(
        await readFile(join(published, "previews", preview, name), "utf8"),
        "forward future navigation",
      );
      assert.equal(
        await readFile(
          join(published, "previews", preview, "index.html"),
          "utf8",
        ),
        "forward to production",
      );
      assert.equal(
        await readFile(
          join(published, "previews", preview, "404.html"),
          "utf8",
        ),
        "forward to production",
      );
    }
  }
  await preparePages(build, published);
  assert.deepEqual(await tree(published), paths);
});

for (const requiredFile of [
  "service-worker.js",
  "licenses.html",
  "THIRD_PARTY_NOTICES.txt",
])
  test(`missing ${requiredFile} fails before changing the published editor`, async (t) => {
    const { build, published, put } = await fixture(t);
    await put(published, "app.mjs", "existing editor");
    await rm(join(build, requiredFile));
    await assert.rejects(preparePages(build, published));
    assert.equal(
      await readFile(join(published, "app.mjs"), "utf8"),
      "existing editor",
    );
  });

test("a new Pages tree receives its domain and both beta retirement worker URLs", async (t) => {
  const { build, published } = await fixture(t);
  await preparePages(build, published);
  assert.equal(
    await readFile(join(published, "CNAME"), "utf8"),
    "fountain-publisher.com\n",
  );
  assert.equal(await readFile(join(published, ".nojekyll"), "utf8"), "");
  assert.equal(
    await readFile(join(published, "previews/beta/service-worker.js"), "utf8"),
    "forward future navigation",
  );
});

test("publication rejects overlapping input and output before pruning", async (t) => {
  const { build } = await fixture(t);
  await assert.rejects(preparePages(build, build), /must not overlap/);
  await assert.rejects(
    preparePages(build, join(build, "published")),
    /must not overlap/,
  );
});
