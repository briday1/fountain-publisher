import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkFountainHosting } from "./check-fountain-hosting.mjs";

test("hosting verification rejects a missing or altered older asset even when the homepage and marker match", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "fp-host-check-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "index.html"), "current homepage");
  await writeFile(join(directory, "assets/previous.js"), "older open tab");
  await writeFile(
    join(directory, "__hosting.json"),
    JSON.stringify({ hosting: "cloudflare", revision: "tested" }),
  );
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/assets/previous.js") return new Response("current homepage");
    return new Response(
      await readFile(
        join(directory, path === "/" ? "index.html" : path.slice(1)),
      ),
      { headers: { "x-fountain-hosting": "cloudflare" } },
    );
  };
  await assert.rejects(
    checkFountainHosting({
      origin: "https://hosting-check.fountain-publisher.com",
      directory,
      revision: "tested",
      fetchImpl,
    }),
    /previous\.js: published contents changed/,
  );
});
