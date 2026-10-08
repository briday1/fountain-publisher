import { readFileSync } from "node:fs";
import { vi } from "vitest";
import * as writing from "../../src/core/writingFonts";

/** Browser exports fetch bundled font URLs; Node tests use those same bytes. */
export function mockBookExportFonts() {
  return vi
    .spyOn(writing, "loadWritingFont")
    .mockImplementation(
      async (id) =>
        Object.fromEntries(
          writing.fontKeys.map((key) => [
            key,
            new Uint8Array(
              readFileSync(
                id === "courier"
                  ? `node_modules/@fontsource/courier-prime/files/courier-prime-latin-${key.includes("bold") ? 700 : 400}-${key.toLowerCase().includes("italic") ? "italic" : "normal"}.woff`
                  : `src/fonts/${writing.writingFonts[id].name.replaceAll(" ", "")}-${key}.woff`,
              ),
            ),
          ]),
        ) as writing.FontBytes,
    );
}
