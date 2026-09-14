import type { Screenplay, ScriptBlock } from "./model";

export interface SceneInsight {
  id: string;
  number: number;
  heading: string;
  location: string;
  timeOfDay: string;
  setting: "INT" | "EXT" | "INT/EXT" | "OTHER";
  blockIndex: number;
  endBlockIndex: number;
  wordCount: number;
  dialogueWords: number;
  actionWords: number;
  characters: string[];
  estimatedPages: number;
  estimatedMinutes: number;
  synopsis: string;
}
export interface CharacterInsight {
  name: string;
  dialogueWords: number;
  speeches: number;
  sceneIds: string[];
  sceneCount: number;
  estimatedMinutes: number;
  share: number;
}
export interface LocationInsight {
  name: string;
  sceneIds: string[];
  sceneCount: number;
  wordCount: number;
}
export interface ScriptInsights {
  scenes: SceneInsight[];
  characters: CharacterInsight[];
  locations: LocationInsight[];
  wordCount: number;
  dialogueWords: number;
  actionWords: number;
  estimatedPages: number;
  estimatedMinutes: number;
  dialoguePercent: number;
  noteCount: number;
  sceneCount: number;
  characterCount: number;
  locationCount: number;
}

export const publishedKinds = new Set([
  "scene",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "lyrics",
  "centered",
  "pageBreak",
]);
export const countWords = (text: string): number =>
  (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
export const characterName = (text: string): string =>
  text
    .replace(/\s*\^$/, "")
    .replace(/(?:\s*\([^)]*\))+\s*$/, "")
    .trim()
    .toLocaleUpperCase();
export const publishedBlocks = (document: Screenplay): ScriptBlock[] =>
  document.blocks.filter((block) => publishedKinds.has(block.kind));

function sceneParts(
  heading: string,
): Pick<SceneInsight, "location" | "setting" | "timeOfDay"> {
  const prefix = heading.match(
    /^(INT\.?\s*\/\s*EXT\.?|INT\.?|EXT\.?|EST\.?|I\/E)[.\s]+/i,
  );
  const value = heading.slice(prefix?.[0].length ?? 0).trim();
  const parts = value.split(/\s+[–—-]\s+/);
  const timeOfDay = parts.length > 1 ? parts.pop()!.trim() : "";
  const setting = !prefix
    ? "OTHER"
    : /\/|I\/E/i.test(prefix[1])
      ? "INT/EXT"
      : /^INT/i.test(prefix[1])
        ? "INT"
        : "EXT";
  return { location: parts.join(" - ").trim() || value, setting, timeOfDay };
}

function estimatedLines(block: ScriptBlock): number {
  if (!publishedKinds.has(block.kind)) return 0;
  if (block.kind === "pageBreak") return 0;
  const width =
    block.kind === "dialogue"
      ? 35
      : block.kind === "parenthetical"
        ? 27
        : block.kind === "character"
          ? 28
          : 60;
  const lines = block.text
    .split("\n")
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil([...line].length / width)),
      0,
    );
  return (
    lines +
    (["character", "dialogue", "parenthetical"].includes(block.kind) ? 0 : 1)
  );
}

/** Pure analysis. The UI can compute this from a deferred snapshot without touching selection. */
export function analyzeScreenplay(document: Screenplay): ScriptInsights {
  const scenes: SceneInsight[] = [];
  const characterMap = new Map<string, CharacterInsight>();
  const locationMap = new Map<string, LocationInsight>();
  let scene: SceneInsight | undefined;
  let speaker: CharacterInsight | undefined;
  let lines = 0;
  let wordCount = 0;
  let dialogueWords = 0;
  let actionWords = 0;
  let noteCount = 0;
  let explicitPages = 0;
  document.blocks.forEach((block, index) => {
    if (block.kind === "note") noteCount++;
    if (block.kind === "scene") {
      if (scene) scene.endBlockIndex = index - 1;
      scene = {
        id: block.id,
        number: scenes.length + 1,
        heading: block.text,
        ...sceneParts(block.text),
        blockIndex: index,
        endBlockIndex: document.blocks.length - 1,
        wordCount: 0,
        dialogueWords: 0,
        actionWords: 0,
        characters: [],
        estimatedPages: 0,
        estimatedMinutes: 0,
        synopsis: "",
      };
      scenes.push(scene);
      speaker = undefined;
      const locationKey = scene.location.toLocaleUpperCase();
      let location = locationMap.get(locationKey);
      if (!location) {
        location = {
          name: scene.location,
          sceneIds: [],
          sceneCount: 0,
          wordCount: 0,
        };
        locationMap.set(locationKey, location);
      }
      location.sceneIds.push(scene.id);
      location.sceneCount++;
    }
    if (block.kind === "synopsis" && scene)
      scene.synopsis += `${scene.synopsis ? "\n" : ""}${block.text}`;
    if (!publishedKinds.has(block.kind)) return;
    if (block.kind === "pageBreak") {
      explicitPages++;
      return;
    }
    const words = countWords(block.text);
    const blockLines = estimatedLines(block);
    lines += blockLines;
    wordCount += words;
    if (scene) {
      scene.wordCount += words;
      scene.estimatedPages += blockLines / 55;
      locationMap.get(scene.location.toLocaleUpperCase())!.wordCount += words;
    }
    if (block.kind === "character") {
      const name = characterName(block.text);
      if (!name) {
        speaker = undefined;
        return;
      }
      speaker = characterMap.get(name);
      if (!speaker) {
        speaker = {
          name,
          dialogueWords: 0,
          speeches: 0,
          sceneIds: [],
          sceneCount: 0,
          estimatedMinutes: 0,
          share: 0,
        };
        characterMap.set(name, speaker);
      }
      speaker.speeches++;
      if (scene && !speaker.sceneIds.includes(scene.id)) {
        speaker.sceneIds.push(scene.id);
        speaker.sceneCount++;
      }
      if (scene && !scene.characters.includes(name))
        scene.characters.push(name);
    } else if (block.kind === "dialogue" || block.kind === "lyrics") {
      dialogueWords += words;
      if (scene) scene.dialogueWords += words;
      if (speaker) speaker.dialogueWords += words;
    } else if (block.kind !== "parenthetical") {
      speaker = undefined;
      if (block.kind === "action" || block.kind === "centered") {
        actionWords += words;
        if (scene) scene.actionWords += words;
      }
    }
  });
  for (const item of scenes)
    item.estimatedMinutes = Math.max(
      item.estimatedPages,
      item.dialogueWords / 150,
    );
  const characters = [...characterMap.values()].sort(
    (a, b) => b.dialogueWords - a.dialogueWords || a.name.localeCompare(b.name),
  );
  for (const character of characters) {
    character.estimatedMinutes = character.dialogueWords / 150;
    character.share = dialogueWords
      ? (character.dialogueWords / dialogueWords) * 100
      : 0;
  }
  const estimatedPages = Math.max(
    wordCount ? 1 : 0,
    Math.ceil(lines / 55) + explicitPages,
  );
  return {
    scenes,
    characters,
    locations: [...locationMap.values()].sort(
      (a, b) => b.sceneCount - a.sceneCount || a.name.localeCompare(b.name),
    ),
    wordCount,
    dialogueWords,
    actionWords,
    estimatedPages,
    estimatedMinutes: Math.max(lines / 55, dialogueWords / 150),
    dialoguePercent:
      dialogueWords + actionWords
        ? (dialogueWords / (dialogueWords + actionWords)) * 100
        : 0,
    noteCount,
    sceneCount: scenes.length,
    characterCount: characters.length,
    locationCount: locationMap.size,
  };
}
