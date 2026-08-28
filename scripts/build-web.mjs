import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const output = "dist/web";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp("src/fountain_publisher/web/index.html", `${output}/index.html`),
  cp("src/fountain_publisher/web/styles.css", `${output}/styles.css`),
  cp("src/fountain_publisher/web/fonts", `${output}/fonts`, { recursive: true }),
  cp("src/fountain_publisher/web/vendor", `${output}/vendor`, { recursive: true }),
  cp("deploy/godaddy/auth", `${output}/auth`, { recursive: true }),
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
