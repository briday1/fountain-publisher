import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { prepareCloudflare } from "./prepare-cloudflare.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "fp-cloudflare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const published = join(root, "published");
  const output = join(root, "output");
  const put = async (name, value = name) => {
    await mkdir(dirname(join(published, name)), { recursive: true });
    await writeFile(join(published, name), value);
  };
  for (const name of [
    "index.html",
    "sw.js",
    "service-worker.js",
    "licenses.html",
    "THIRD_PARTY_NOTICES.txt",
  ])
    await put(name);
  return { published, output, put };
}

test("hosting migration retains older assets, offline shells and links while excluding Git metadata", async (t) => {
  const { published, output, put } = await fixture(t);
  for (const name of [
    "assets/previous.js",
    "offline-shell-previous.html",
    "previews/pr-86/assets/old.js",
    "previews/beta/redirect.js",
    ".git/config",
    "CNAME",
    ".nojekyll",
  ])
    await put(name);
  await prepareCloudflare(published, output, "tested-revision");
  for (const name of [
    "assets/previous.js",
    "offline-shell-previous.html",
    "previews/pr-86/assets/old.js",
    "previews/beta/redirect.js",
  ]) {
    assert.equal(await readFile(join(output, name), "utf8"), name);
  }
  await assert.rejects(stat(join(output, ".git")), { code: "ENOENT" });
  assert.equal(
    await readFile(join(published, ".git/config"), "utf8"),
    ".git/config",
  );
  assert.equal(await readFile(join(published, "CNAME"), "utf8"), "CNAME");
  assert.deepEqual(
    JSON.parse(await readFile(join(output, "__hosting.json"), "utf8")),
    { hosting: "cloudflare", revision: "tested-revision" },
  );
  await assert.rejects(stat(join(output, "_redirects")), { code: "ENOENT" });
});

test("an incomplete source fails before replacing the last prepared artifact", async (t) => {
  const { published, output } = await fixture(t);
  await mkdir(output);
  await writeFile(join(output, "index.html"), "previous artifact");
  await rm(join(published, "sw.js"));
  await assert.rejects(prepareCloudflare(published, output));
  assert.equal(
    await readFile(join(output, "index.html"), "utf8"),
    "previous artifact",
  );
});

test("hosting preparation rejects overlapping source and output directories", async (t) => {
  const { published } = await fixture(t);
  await assert.rejects(
    prepareCloudflare(published, published),
    /must not overlap/,
  );
  await assert.rejects(
    prepareCloudflare(published, join(published, "output")),
    /must not overlap/,
  );
});
