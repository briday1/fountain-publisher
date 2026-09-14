import { characterName } from "./insights";

export interface CharacterHighlight {
  name: string;
  color: string;
  rgb: [number, number, number];
}

/** A shared, deterministic swatch for the chooser and the published cue. */
export function characterHighlights(
  names: readonly string[],
): CharacterHighlight[] {
  return [...new Set(names.map(characterName).filter(Boolean))]
    .sort()
    .map((name, index) => {
      const hue = (45 + index * 137.508) % 360;
      const saturation = 0.8,
        lightness = 0.82;
      const a = saturation * Math.min(lightness, 1 - lightness);
      const channel = (n: number) => {
        const k = (n + hue / 30) % 12;
        return Math.round(
          255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
        );
      };
      const channels = [channel(0), channel(8), channel(4)];
      return {
        name,
        color: `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
        rgb: channels.map((value) => value / 255) as [number, number, number],
      };
    });
}

export function highlightedPdfFilename(
  filename: string,
  names: readonly string[],
) {
  const clean = (value: string) =>
    value
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^[. -]+|[. -]+$/g, "");
  const stem = clean(filename.replace(/\.[^.]+$/, "")) || "Screenplay";
  const cast = characterHighlights(names).map(
    ({ name }) => clean(name) || "Character",
  );
  // Keep ordinary casts explicit; large casts still get a portable filename.
  let suffix = "";
  for (let i = 0; i < cast.length; i++) {
    const next = `${suffix}${suffix ? "-" : ""}${cast[i].slice(0, 40)}`;
    if (new TextEncoder().encode(next).length > 130) {
      suffix += `-and-${cast.length - i}-more`;
      break;
    }
    suffix = next;
  }
  let shortStem = stem;
  while (new TextEncoder().encode(shortStem).length > 65)
    shortStem = [...shortStem].slice(0, -1).join("");
  return `${shortStem}-highlighted-${suffix || "characters"}.pdf`;
}
