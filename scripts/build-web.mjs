import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const output = "dist/web";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp("src/fountain_publisher/web/index.html", `${output}/index.html`),
  cp("src/fountain_publisher/web/styles.css", `${output}/styles.css`),
]);
await build({
  entryPoints: ["src/fountain_publisher/web/app.mjs"],
  outfile: `${output}/app.mjs`,
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
});
