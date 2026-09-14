export type BlockKind =
  | "scene"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "section"
  | "synopsis"
  | "note"
  | "lyrics"
  | "centered"
  | "pageBreak"
  | "boneyard";
export type TextMark = "bold" | "italic" | "underline";
export interface TextSpan {
  text: string;
  marks?: TextMark[];
}
export interface ScriptBlock {
  id: string;
  kind: BlockKind;
  text: string;
  spans?: TextSpan[];
  sceneNumber?: string;
  level?: number;
  dual?: boolean;
}
export interface TitlePage {
  title: string;
  credit: string;
  author: string;
  source: string;
  draftDate: string;
  contact: string;
  extra?: Record<string, string>;
}
export interface TextAnchor {
  blockId: string;
  /** UTF-16 offset in the rendered block text. */
  offset: number;
}
export interface BeatRange {
  start: TextAnchor;
  /** Exclusive endpoint, like a text selection. */
  end: TextAnchor;
}
export interface Beat {
  id: string;
  title: string;
  description: string;
  sceneId?: string;
  range?: BeatRange;
  color: string;
  act: string;
}
export interface ScriptMetadata {
  version: 1;
  beats: Beat[];
  notes: string;
  [key: string]: unknown;
}
export interface Screenplay {
  titlePage: TitlePage;
  blocks: ScriptBlock[];
  metadata: ScriptMetadata;
}
export const newId = (): string => globalThis.crypto.randomUUID();
export const emptyTitlePage = (): TitlePage => ({
  title: "",
  credit: "Written by",
  author: "",
  source: "",
  draftDate: "",
  contact: "",
});
export const emptyScreenplay = (): Screenplay => ({
  titlePage: emptyTitlePage(),
  blocks: [{ id: newId(), kind: "action", text: "" }],
  metadata: { version: 1, beats: [], notes: "" },
});
export const blockLabels: Record<BlockKind, string> = {
  scene: "Scene heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
  section: "Section",
  synopsis: "Synopsis",
  note: "Note",
  lyrics: "Lyrics",
  centered: "Centered",
  pageBreak: "Page break",
  boneyard: "Omitted text",
};
