import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Upload the complete publication tree, including assets used by older open tabs.
// Git history remains in gh-pages; its administrative files never become assets.
export async function prepareCloudflare(
  publishedDirectory,
  outputDirectory,
  revision = "",
) {
  const published = resolve(publishedDirectory);
  const output = resolve(outputDirectory);
  if (
    published === output ||
    published.startsWith(output + sep) ||
    output.startsWith(published + sep)
  ) {
    throw new Error("Published and output directories must not overlap.");
  }
  for (const name of [
    "index.html",
    "sw.js",
    "service-worker.js",
    "licenses.html",
    "THIRD_PARTY_NOTICES.txt",
  ]) {
    const file = await stat(join(published, name));
    if (!file.isFile() || !file.size)
      throw new Error(`Missing or empty publication file: ${name}`);
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(published, output, {
    recursive: true,
    filter: (path) => ![".git", "CNAME", ".nojekyll"].includes(basename(path)),
  });
  await writeFile(
    join(output, "_headers"),
    [
      "/*",
      "  X-Fountain-Hosting: cloudflare",
      "/sw.js",
      "  Cache-Control: no-cache",
      "/service-worker.js",
      "  Cache-Control: no-cache",
      "https://hosting-check.fountain-publisher.com/*",
      "  X-Robots-Tag: noindex",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(output, "_redirects"),
    "https://www.fountain-publisher.com/* https://fountain-publisher.com/:splat 301\n",
  );
  await writeFile(
    join(output, "__hosting.json"),
    JSON.stringify({ hosting: "cloudflare", revision }) + "\n",
  );
  // Check the copy rather than assuming directory copying kept the active shell.
  if (
    !(await readFile(join(output, "index.html"))).equals(
      await readFile(join(published, "index.html")),
    )
  ) {
    throw new Error("Publication index changed during preparation.");
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length < 4 || process.argv.length > 5)
    throw new Error(
      "Usage: node prepare-cloudflare.mjs PUBLISHED OUTPUT [REVISION]",
    );
  await prepareCloudflare(
    process.argv[2],
    process.argv[3],
    process.argv[4] || "",
  );
}
