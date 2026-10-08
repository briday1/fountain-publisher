import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

async function paths(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await paths(directory, path)));
    else if (entry.isFile() && !["_headers", "_redirects"].includes(path))
      result.push(path);
  }
  return result;
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function checkFountainHosting({
  origin,
  directory,
  revision,
  fetchImpl = fetch,
}) {
  const base = new URL(origin);
  assert.equal(base.protocol, "https:");
  // A new custom hostname may need a short DNS/TLS propagation interval.
  // Do not begin preservation checks until the exact release marker is live.
  let ready = false;
  let readinessError;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const marker = await fetchImpl(new URL("/__hosting.json", base), {
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(marker.status, 200, "Hosting marker is unavailable");
      assert.deepEqual(await marker.json(), {
        hosting: "cloudflare",
        revision,
      });
      ready = true;
      break;
    } catch (error) {
      readinessError = error;
      if (attempt < 39) await delay(3000);
    }
  }
  if (!ready)
    throw new Error(
      `Hosting did not become ready: ${readinessError?.cause?.code || readinessError?.message}`,
    );
  const files = await paths(directory);
  // Check every retained file. A matching homepage alone cannot prove that an
  // already-open tab can still fetch its older JavaScript, font or offline shell.
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < files.length) {
        const path = files[next++];
        const response = await fetchImpl(new URL("/" + path, base), {
          signal: AbortSignal.timeout(30000),
        });
        assert.equal(response.status, 200, `${path}: file is unavailable`);
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = await readFile(join(directory, path));
        assert.equal(
          hash(actual),
          hash(expected),
          `${path}: published contents changed`,
        );
      }
    }),
  );
  const home = await fetchImpl(base, { signal: AbortSignal.timeout(15000) });
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-fountain-hosting"), "cloudflare");
  assert.equal(
    hash(Buffer.from(await home.arrayBuffer())),
    hash(await readFile(join(directory, "index.html"))),
  );
  if (base.hostname === "fountain-publisher.com") {
    const www = await fetchImpl(
      "https://www.fountain-publisher.com/?room=hosting-check",
      { redirect: "manual", signal: AbortSignal.timeout(15000) },
    );
    assert.ok(
      [301, 302, 307, 308].includes(www.status),
      "www must redirect to the existing apex origin",
    );
    assert.equal(
      www.headers.get("location"),
      "https://fountain-publisher.com/?room=hosting-check",
    );
    await www.body?.cancel();
  }
  return files.length;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 5)
      throw new Error(
        "Usage: node check-fountain-hosting.mjs ORIGIN DIRECTORY REVISION",
      );
    const count = await checkFountainHosting({
      origin: process.argv[2],
      directory: process.argv[3],
      revision: process.argv[4],
    });
    console.log(
      `Verified Cloudflare hosting and all ${count} publication files.`,
    );
  } catch (error) {
    console.error(`Hosting verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
