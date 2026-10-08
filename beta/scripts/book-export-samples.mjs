import { createServer } from "vite";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(
  process.argv[2] || "../output/book-export-fidelity",
);
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  ssr: { noExternal: [/@fontsource\//] },
  optimizeDeps: { noDiscovery: true },
});
try {
  const { bookExportFixture } = await server.ssrLoadModule(
    "/tests/fixtures/book-export.ts",
  );
  const { exportNovel } = await server.ssrLoadModule(
    "/src/core/novelExport.ts",
  );
  const { serializeMarkdown } = await server.ssrLoadModule(
    "/src/core/markdown.ts",
  );
  const { openTypeBytes } = await server.ssrLoadModule(
    "/src/core/fontEmbedding.ts",
  );
  const fontBytes = Object.fromEntries(
    await Promise.all(
      ["regular", "bold", "italic", "boldItalic"].map(async (key) => [
        key,
        new Uint8Array(await readFile(`src/fonts/DejaVuSerif-${key}.woff`)),
      ]),
    ),
  );
  await mkdir(output, { recursive: true });
  const doc = bookExportFixture();
  await writeFile(path.join(output, "manuscript.md"), serializeMarkdown(doc));
  await writeFile(
    path.join(output, "manuscript.json"),
    JSON.stringify(doc, null, 2),
  );
  const exports = [];
  for (const variant of ["default", "selected"]) {
    const options =
      variant === "selected" ? { fontName: "DejaVu Serif", fontBytes } : {};
    for (const format of ["pdf", "docx", "epub", "rtf"]) {
      const result = await exportNovel(doc, format, options);
      const file = `book-${variant}.${format}`;
      await writeFile(
        path.join(output, file),
        new Uint8Array(await result.blob.arrayBuffer()),
      );
      exports.push({ file, warnings: result.warnings });
    }
  }
  // Reader-host fonts allow testing RTF's family reference separately from embedding.
  const hostFonts = path.join(output, "qa-fonts");
  await mkdir(hostFonts, { recursive: true });
  for (const [key, bytes] of Object.entries(fontBytes))
    await writeFile(
      path.join(hostFonts, `DejaVuSerif-${key}.ttf`),
      openTypeBytes(bytes),
    );
  await writeFile(
    path.join(output, "export-results.json"),
    JSON.stringify(exports, null, 2),
  );
  console.log(JSON.stringify({ output, exports }));
} finally {
  await server.close();
}
