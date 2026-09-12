import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const output = "dist/web";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp("src/fountain_publisher/web/index.html", `${output}/index.html`),
  cp("src/fountain_publisher/web/privacy.html", `${output}/privacy.html`),
  cp("src/fountain_publisher/web/terms.html", `${output}/terms.html`),
  cp("src/fountain_publisher/web/THIRD_PARTY_NOTICES.md", `${output}/THIRD_PARTY_NOTICES.md`),
  cp("src/fountain_publisher/web/styles.css", `${output}/styles.css`),
  cp("src/fountain_publisher/web/app.webmanifest", `${output}/app.webmanifest`),
  cp("src/fountain_publisher/web/service-worker.js", `${output}/service-worker.js`),
  cp("src/fountain_publisher/web/collaboration.mjs", `${output}/collaboration.mjs`),
  cp("src/fountain_publisher/web/editor-contract.mjs", `${output}/editor-contract.mjs`),
  cp("src/fountain_publisher/web/fountain-inline.mjs", `${output}/fountain-inline.mjs`),
  cp("src/fountain_publisher/web/text-input.mjs", `${output}/text-input.mjs`),
  cp("src/fountain_publisher/web/local-compiler.mjs", `${output}/local-compiler.mjs`),
  ...["document-search.mjs", "search-engine.mjs", "search-worker.mjs", "search-client.mjs"].map((asset) => cp(`src/fountain_publisher/web/${asset}`, `${output}/${asset}`)),
  cp("src/fountain_publisher/web/compiler-client.mjs", `${output}/compiler-client.mjs`),
  cp("src/fountain_publisher/web/compiler-worker.mjs", `${output}/compiler-worker.mjs`),
  cp("src/fountain_publisher/web/compiler-runtime.mjs", `${output}/compiler-runtime.mjs`),
  cp("src/fountain_publisher/web/background-performance.mjs", `${output}/background-performance.mjs`),
  cp("src/fountain_publisher/web/icons", `${output}/icons`, { recursive: true }),
  cp("src/fountain_publisher/web/fonts", `${output}/fonts`, { recursive: true }),
  cp("src/fountain_publisher/web/vendor", `${output}/vendor`, { recursive: true }),
  cp("node_modules/pyodide", `${output}/pyodide`, { recursive: true }),
]);
await cp("src/fountain_publisher/web/vendor/micropip-0.11.1-py3-none-any.whl", `${output}/pyodide/micropip-0.11.1-py3-none-any.whl`);
await build({
  entryPoints: ["src/fountain_publisher/web/app.mjs"],
  outfile: `${output}/app.mjs`,
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
});
