import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Files from the retired Python/Screenplain editor, never used by the current
// Vite app. Keep this explicit: current hashed assets may serve an open tab.
const legacyPaths = [
  "app.mjs",
  "app.webmanifest",
  "background-performance.mjs",
  "collaboration.mjs",
  "compiler-client.mjs",
  "compiler-runtime.mjs",
  "compiler-worker.mjs",
  "document-search.mjs",
  "editor-contract.mjs",
  "fountain-inline.mjs",
  "local-compiler.mjs",
  "search-client.mjs",
  "search-engine.mjs",
  "search-worker.mjs",
  "text-input.mjs",
  "styles.css",
  "pyodide",
  "vendor",
  "fonts",
  "icons",
  "THIRD_PARTY_NOTICES.md",
];

async function removeLegacyRuntime(directory) {
  await Promise.all(
    legacyPaths.map((name) =>
      rm(join(directory, name), { recursive: true, force: true }),
    ),
  );
}

/** Prepare a checked-out Pages tree without touching its Git metadata or drafts. */
export async function preparePages(buildDirectory, publishedDirectory) {
  const build = resolve(buildDirectory);
  const published = resolve(publishedDirectory);
  if (
    build === published ||
    build.startsWith(published + sep) ||
    published.startsWith(build + sep)
  ) {
    throw new Error("Build and published directories must not overlap.");
  }
  const redirect = join(build, "previews/beta");
  // Fail before removing anything when an artifact is absent or incomplete.
  for (const name of [
    "index.html",
    "sw.js",
    "service-worker.js",
    "licenses.html",
    "THIRD_PARTY_NOTICES.txt",
    "previews/beta/index.html",
    "previews/beta/redirect.js",
    "previews/beta/sw.js",
  ]) {
    const file = await stat(join(build, name));
    if (!file.isFile() || file.size === 0) {
      throw new Error(`Missing or empty build file: ${name}`);
    }
  }

  await mkdir(published, { recursive: true });
  await removeLegacyRuntime(published);
  for (const entry of await readdir(build)) {
    if ([".git", "previews", "CNAME", ".nojekyll"].includes(entry)) continue;
    await cp(join(build, entry), join(published, entry), { recursive: true });
  }
  await writeFile(join(published, ".nojekyll"), "");
  const cname = join(published, "CNAME");
  let domain = "";
  try {
    domain = await readFile(cname, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!domain.trim()) await writeFile(cname, "fountain-publisher.com\n");

  const previews = join(published, "previews");
  await mkdir(join(previews, "beta"), { recursive: true });
  for (const entry of await readdir(previews, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^(?:beta|pr-\d+)$/.test(entry.name)) continue;
    const destination = join(previews, entry.name);
    await removeLegacyRuntime(destination);
    // These files can navigate directly into a retired app. Its hashed assets
    // remain for open current-editor tabs; future navigation goes to production.
    for (const name of await readdir(destination)) {
      if (/^offline-shell-.*\.html$/.test(name)) {
        await rm(join(destination, name));
      }
    }
    await cp(redirect, destination, { recursive: true });
    await cp(join(redirect, "index.html"), join(destination, "404.html"));
    await cp(join(redirect, "sw.js"), join(destination, "service-worker.js"));
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 4) {
    throw new Error(
      "Usage: node prepare-pages.mjs BUILD_DIRECTORY PUBLISHED_DIRECTORY",
    );
  }
  await preparePages(process.argv[2], process.argv[3]);
}
