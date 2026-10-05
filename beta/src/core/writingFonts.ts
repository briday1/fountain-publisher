import regular from "@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url";
import bold from "@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url";
import italic from "@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff?url";
import boldItalic from "@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff?url";
export const writingFonts = {
  courier: {
    name: "Courier Prime",
    css: '"Courier Prime", "Courier New", monospace',
  },
  georgia: { name: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  mono: { name: "DejaVu Sans Mono", css: '"DejaVu Sans Mono", monospace' },
  serif: { name: "DejaVu Serif", css: '"DejaVu Serif", serif' },
  sans: { name: "DejaVu Sans", css: '"DejaVu Sans", sans-serif' },
} as const;
export type WritingFont = keyof typeof writingFonts;
export const screenplayFonts: WritingFont[] = ["courier", "mono", "sans"];
export const bookFonts: WritingFont[] = ["georgia", "serif", "sans", "courier"];
export const fontKeys = ["regular", "bold", "italic", "boldItalic"] as const;
export type FontBytes = Record<(typeof fontKeys)[number], Uint8Array>;
const bundled = import.meta.glob<string>("../fonts/*.woff", {
  query: "?url",
  import: "default",
  eager: true,
});
export async function loadWritingFont(id: WritingFont): Promise<FontBytes> {
  if (id === "georgia")
    throw new Error(
      "Choose Georgia font files to preserve Georgia in this PDF, or choose a bundled writing font.",
    );
  const urls =
    id === "courier"
      ? { regular, bold, italic, boldItalic }
      : Object.fromEntries(
          fontKeys.map((key) => [
            key,
            bundled[
              `../fonts/${writingFonts[id].name.replaceAll(" ", "")}-${key}.woff`
            ],
          ]),
        );
  return Object.fromEntries(
    await Promise.all(
      fontKeys.map(async (key) => {
        const response = await fetch(urls[key]);
        if (!response.ok)
          throw new Error(
            `Could not load ${writingFonts[id].name}. Try the export again.`,
          );
        return [key, new Uint8Array(await response.arrayBuffer())];
      }),
    ),
  ) as FontBytes;
}
export async function readGeorgiaFiles(files: File[]): Promise<FontBytes> {
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const found: Partial<FontBytes> = {};
  for (const file of files) {
    if (file.size > 10_000_000)
      throw new Error("Each font file must be smaller than 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const face = fontkit.create(bytes) as unknown as {
      familyName: string;
      subfamilyName: string;
      postscriptName: string;
      [key: string]: unknown;
    };
    if (!/^Georgia(?:\s|$)/i.test(face.familyName || ""))
      throw new Error("Choose the Georgia font files for this export.");
    const style = `${face.subfamilyName} ${face.postscriptName}`;
    const isBold = /bold/i.test(style),
      isItalic = /italic|oblique/i.test(style);
    found[
      isBold
        ? isItalic
          ? "boldItalic"
          : "bold"
        : isItalic
          ? "italic"
          : "regular"
    ] = bytes;
  }
  if (fontKeys.some((key) => !found[key]))
    throw new Error(
      "Include all four Georgia styles: Regular, Bold, Italic, and Bold Italic.",
    );
  return found as FontBytes;
}
