import * as Y from "yjs";
import type { Node as PMNode } from "prosemirror-model";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  initProseMirrorDoc,
  prosemirrorToYXmlFragment,
} from "y-prosemirror";
type ProsemirrorMapping = ReturnType<typeof initProseMirrorDoc>["mapping"];
import type { Beat, BeatRange, Screenplay, TitlePage } from "../core/model";
import { blockLabels, emptyTitlePage } from "../core/model";
import { sceneBeatRange } from "../core/beatRanges";
import { anchorPosition, textAnchor } from "../editor/beatAnchors";
import { blocksToDoc, docToBlocks, screenplaySchema } from "../editor/schema";

/** Local transaction origin: received network updates never carry this identity. */
export const sharedMetadataOrigin = Symbol("screenplay metadata");
export interface SharedView {
  doc: PMNode;
  mapping: ProsemirrorMapping;
}
export interface SharedRange {
  start: ReturnType<typeof Y.relativePositionToJSON>;
  end: ReturnType<typeof Y.relativePositionToJSON>;
  empty: boolean;
}
export interface SharedPositionRange {
  from: number;
  to: number;
}
const titleFields = [
  "title",
  "credit",
  "author",
  "source",
  "draftDate",
  "contact",
] as const;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const script = (doc: Y.Doc) => doc.getXmlFragment("script");
export const sharedDetails = (doc: Y.Doc) => doc.getMap<unknown>("details");
export function sharedBeats(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return sharedDetails(doc).get("beats") as Y.Map<Y.Map<unknown>>;
}
const context = (doc: Y.Doc): SharedView =>
  initProseMirrorDoc(script(doc), screenplaySchema);
const plainText = (value: unknown): string =>
  value instanceof Y.Text ? value.toString() : "";
function setText(map: Y.Map<unknown>, key: string, value: string) {
  let text = map.get(key);
  if (!(text instanceof Y.Text)) {
    text = new Y.Text();
    map.set(key, text);
  }
  const current = (text as Y.Text).toString();
  if (current === value) return;
  let start = 0;
  while (
    start < current.length &&
    start < value.length &&
    current[start] === value[start]
  )
    start++;
  let end = 0;
  while (
    end < current.length - start &&
    end < value.length - start &&
    current[current.length - 1 - end] === value[value.length - 1 - end]
  )
    end++;
  if (start && /[\uDC00-\uDFFF]/.test(current[start] ?? value[start] ?? ""))
    start--;
  if (
    end &&
    /[\uD800-\uDBFF]/.test(
      current[current.length - end - 1] ?? value[value.length - end - 1] ?? "",
    )
  )
    end--;
  if (current.length - start - end)
    (text as Y.Text).delete(start, current.length - start - end);
  if (value.length - start - end)
    (text as Y.Text).insert(start, value.slice(start, value.length - end));
}
/** Resolve against the current binding mapping, after its view update. */
export function resolveSharedRange(
  doc: Y.Doc,
  range: unknown,
  view: SharedView,
  original = false,
): SharedPositionRange | undefined {
  if (
    !range ||
    typeof range !== "object" ||
    !("start" in range) ||
    !("end" in range)
  )
    return;
  try {
    const aliases = sharedDetails(doc).get("aliases") as Y.Map<unknown>;
    const decode = (value: unknown) =>
      Y.createRelativePositionFromJSON(
        !original && aliases.has(JSON.stringify(value))
          ? aliases.get(JSON.stringify(value))
          : value,
      );
    const from = relativePositionToAbsolutePosition(
      doc,
      script(doc),
      decode(range.start),
      view.mapping,
    );
    const to = relativePositionToAbsolutePosition(
      doc,
      script(doc),
      decode(range.end),
      view.mapping,
    );
    if (
      from === null ||
      to === null ||
      from > to ||
      (from === to && !("empty" in range && range.empty))
    )
      return;
    if (!textAnchor(view.doc, from) || !textAnchor(view.doc, to)) return;
    return { from, to };
  } catch {
    return;
  }
}
function relativeAt(doc: Y.Doc, view: SharedView, pos: number, assoc: number) {
  const relative = absolutePositionToRelativePosition(
    pos,
    script(doc),
    view.mapping,
  );
  const absolute = Y.createAbsolutePositionFromRelativePosition(relative, doc);
  return Y.relativePositionToJSON(
    absolute
      ? Y.createRelativePositionFromTypeIndex(
          absolute.type,
          absolute.index,
          assoc,
        )
      : relative,
  );
}
export function refreshSharedRangeAliases(doc: Y.Doc, view: SharedView): void {
  const aliases = sharedDetails(doc).get("aliases") as Y.Map<unknown>;
  doc.transact(() => {
    for (const beat of sharedBeats(doc).values()) {
      const before = beat.get("range") as SharedRange | null;
      const positions = resolveSharedRange(doc, before, view, true);
      if (!before || !positions) continue;
      const after = sharedRangeAt(doc, view, positions);
      for (const key of ["start", "end"] as const) {
        const id = JSON.stringify(before[key]);
        if (
          !same(before[key], after[key]) &&
          !same(aliases.get(id), after[key])
        )
          aliases.set(id, after[key]);
      }
    }
  }, "restore-shared-anchors");
}
export function sharedRangeAt(
  doc: Y.Doc,
  view: SharedView,
  range: SharedPositionRange,
): SharedRange {
  return {
    start: relativeAt(doc, view, range.from, 0),
    end: relativeAt(doc, view, range.to, -1),
    empty: range.from === range.to,
  };
}
function rangeFromBeat(
  doc: Y.Doc,
  screenplay: Screenplay,
  beat: Beat,
  view: SharedView,
): SharedRange | null {
  const range =
    beat.range ??
    (beat.sceneId ? sceneBeatRange(screenplay, beat.sceneId) : undefined);
  if (!range) return null;
  const from = anchorPosition(view.doc, range.start),
    to = anchorPosition(view.doc, range.end);
  return from !== undefined && to !== undefined && from <= to
    ? sharedRangeAt(doc, view, { from, to })
    : null;
}
export function readSharedDetails(
  doc: Y.Doc,
  view: SharedView,
): Pick<Screenplay, "titlePage" | "metadata"> {
  const details = sharedDetails(doc),
    title = details.get("titlePage") as Y.Map<unknown>,
    metadata = details.get("metadata") as Y.Map<unknown>;
  const titlePage = emptyTitlePage();
  for (const key of titleFields) titlePage[key] = plainText(title.get(key));
  if (title.has("extra"))
    titlePage.extra = title.get("extra") as TitlePage["extra"];
  const beats: Beat[] = [...sharedBeats(doc)]
    .sort(
      ([a, aa], [b, bb]) =>
        Number(aa.get("order")) - Number(bb.get("order")) || a.localeCompare(b),
    )
    .map(([id, value]) => {
      const positions = resolveSharedRange(doc, value.get("range"), view);
      let range: BeatRange | undefined;
      if (positions) {
        const start = textAnchor(view.doc, positions.from),
          end = textAnchor(view.doc, positions.to);
        if (start && end) range = { start, end };
      }
      return {
        id,
        title: plainText(value.get("title")),
        description: plainText(value.get("description")),
        color: value.get("color") as string,
        act: value.get("act") as string,
        ...(range ? { range } : {}),
      };
    });
  const extras = Object.fromEntries(
    [...metadata].filter(([key]) => key !== "notes"),
  );
  return {
    titlePage,
    metadata: {
      ...extras,
      version: 1,
      notes: plainText(metadata.get("notes")),
      beats,
    },
  };
}
export function readSharedDocument(
  doc: Y.Doc,
  view = context(doc),
): Screenplay {
  return { ...readSharedDetails(doc, view), blocks: docToBlocks(view.doc) };
}
/** Patch only fields the caller changed, so stale forms cannot overwrite unrelated edits. */
export function updateSharedDetails(
  doc: Y.Doc,
  next: Screenplay,
  previous: Screenplay,
  view: SharedView,
): void {
  const details = sharedDetails(doc),
    title = details.get("titlePage") as Y.Map<unknown>,
    metadata = details.get("metadata") as Y.Map<unknown>,
    beats = sharedBeats(doc);
  doc.transact(() => {
    for (const key of titleFields)
      if (next.titlePage[key] !== previous.titlePage[key])
        setText(title, key, next.titlePage[key]);
    if (!same(next.titlePage.extra, previous.titlePage.extra)) {
      if (next.titlePage.extra) title.set("extra", next.titlePage.extra);
      else title.delete("extra");
    }
    if (next.metadata.notes !== previous.metadata.notes)
      setText(metadata, "notes", next.metadata.notes);
    for (const key of new Set([
      ...Object.keys(next.metadata),
      ...Object.keys(previous.metadata),
    ])) {
      if (
        ["version", "notes", "beats"].includes(key) ||
        same(next.metadata[key], previous.metadata[key])
      )
        continue;
      if (next.metadata[key] === undefined) metadata.delete(key);
      else metadata.set(key, next.metadata[key]);
    }
    const before = new Map(
      previous.metadata.beats.map((beat) => [beat.id, beat]),
    );
    const nextIds = new Set(next.metadata.beats.map((beat) => beat.id));
    for (const id of before.keys()) if (!nextIds.has(id)) beats.delete(id);
    next.metadata.beats.forEach((beat, order) => {
      const old = before.get(beat.id);
      let target = beats.get(beat.id);
      // A stale edit cannot resurrect a deleted beat; explicit additions can create it.
      if (!target && old) return;
      if (!target) {
        target = new Y.Map();
        beats.set(beat.id, target);
      }
      for (const key of ["title", "description"] as const)
        if (!old || beat[key] !== old[key]) setText(target, key, beat[key]);
      for (const key of ["color", "act"] as const)
        if (!old || beat[key] !== old[key]) target.set(key, beat[key]);
      if (!old || previous.metadata.beats[order]?.id !== beat.id)
        target.set("order", order);
      if (!old || !same(beat.range, old.range) || beat.sceneId !== old.sceneId)
        target.set("range", rangeFromBeat(doc, next, beat, view));
    });
  }, sharedMetadataOrigin);
}
export function createSharedDocument(screenplay: Screenplay): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    prosemirrorToYXmlFragment(blocksToDoc(screenplay.blocks), script(doc));
    const details = sharedDetails(doc);
    details.set("schemaVersion", 1);
    const title = new Y.Map<unknown>();
    details.set("titlePage", title);
    for (const key of titleFields)
      title.set(key, new Y.Text(screenplay.titlePage[key]));
    if (screenplay.titlePage.extra)
      title.set("extra", screenplay.titlePage.extra);
    const metadata = new Y.Map<unknown>();
    details.set("metadata", metadata);
    for (const [key, value] of Object.entries(screenplay.metadata))
      if (!["notes", "beats", "version"].includes(key))
        metadata.set(key, value);
    metadata.set("notes", new Y.Text(screenplay.metadata.notes));
    details.set("beats", new Y.Map());
    details.set("aliases", new Y.Map());
    updateSharedDetails(
      doc,
      screenplay,
      { ...screenplay, metadata: { ...screenplay.metadata, beats: [] } },
      context(doc),
    );
  });
  validateSharedDocument(doc);
  return doc;
}
function invalid(): never {
  throw new Error("The shared screenplay contains invalid or oversized data.");
}
function text(value: unknown, max: number) {
  if (!(value instanceof Y.Text) || value.length > max) invalid();
  for (const part of value.toDelta())
    if (
      typeof part.insert !== "string" ||
      (part.attributes && Object.keys(part.attributes).length)
    )
      invalid();
}
function json(value: unknown, depth = 0): number {
  if (depth > 12 || value instanceof Y.AbstractType) return invalid();
  if (value === null || typeof value === "boolean") return 4;
  if (typeof value === "number") return Number.isFinite(value) ? 8 : invalid();
  if (typeof value === "string") return value.length;
  if (Array.isArray(value))
    return value.reduce((n, v) => n + json(v, depth + 1), 0);
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return invalid();
  return Object.entries(value).reduce(
    (n, [key, v]) => n + key.length + json(v, depth + 1),
    0,
  );
}
function relative(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => !["type", "tname", "item", "assoc"].includes(k))
  )
    invalid();
  if (r.assoc !== undefined && r.assoc !== 0 && r.assoc !== -1) invalid();
  for (const key of ["type", "item"])
    if (r[key] !== undefined && r[key] !== null) {
      const id = r[key] as Record<string, unknown>;
      if (
        typeof id !== "object" ||
        Object.keys(id).some((k) => !["client", "clock"].includes(k)) ||
        !Number.isSafeInteger(id.client) ||
        Number(id.client) < 0 ||
        !Number.isSafeInteger(id.clock) ||
        Number(id.clock) < 0
      )
        invalid();
    }
  if (r.tname !== undefined && r.tname !== null && r.tname !== "script")
    invalid();
}
/** Called on untrusted room updates before persistence or broadcast. */
export function validateSharedDocument(doc: Y.Doc): void {
  if (
    doc.share.size !== 2 ||
    [...doc.share.keys()].some((key) => key !== "script" && key !== "details")
  )
    invalid();
  const fragment = script(doc),
    details = sharedDetails(doc);
  if (
    fragment.length < 1 ||
    fragment.length > 20000 ||
    details.size !== 5 ||
    details.get("schemaVersion") !== 1
  )
    invalid();
  let total = 0;
  const ids = new Set<string>();
  for (const node of fragment.toArray()) {
    if (!(node instanceof Y.XmlElement) || node.nodeName !== "screenplayBlock")
      invalid();
    const attrs = node.getAttributes() as Record<string, unknown>;
    if (
      Object.keys(attrs).some(
        (k) =>
          ![
            "id",
            "kind",
            "sceneNumber",
            "level",
            "dual",
            "manual",
            "automatic",
            "autoFrom",
          ].includes(k),
      )
    )
      invalid();
    if (
      typeof attrs.id !== "string" ||
      !attrs.id ||
      attrs.id.length > 200 ||
      ids.has(attrs.id)
    )
      invalid();
    ids.add(attrs.id);
    if (
      typeof attrs.kind !== "string" ||
      !Object.hasOwn(blockLabels, attrs.kind)
    )
      invalid();
    if (
      attrs.sceneNumber !== null &&
      attrs.sceneNumber !== undefined &&
      (typeof attrs.sceneNumber !== "string" || attrs.sceneNumber.length > 200)
    )
      invalid();
    if (
      attrs.level !== undefined &&
      (!Number.isInteger(attrs.level) ||
        Number(attrs.level) < 1 ||
        Number(attrs.level) > 12)
    )
      invalid();
    for (const key of ["dual", "manual", "automatic"])
      if (attrs[key] !== undefined && typeof attrs[key] !== "boolean")
        invalid();
    if (
      attrs.autoFrom !== undefined &&
      (typeof attrs.autoFrom !== "string" ||
        !Object.hasOwn(blockLabels, attrs.autoFrom))
    )
      invalid();
    for (const child of node.toArray()) {
      if (!(child instanceof Y.XmlText)) invalid();
      for (const part of child.toDelta()) {
        if (typeof part.insert !== "string") invalid();
        total += part.insert.length;
        if (
          part.attributes &&
          Object.entries(part.attributes).some(
            ([key, value]) =>
              !["bold", "italic", "underline"].includes(key) ||
              typeof value !== "object" ||
              value === null ||
              Object.keys(value).length,
          )
        )
          invalid();
      }
    }
  }
  const aliases = details.get("aliases");
  if (!(aliases instanceof Y.Map) || aliases.size > 20000) invalid();
  for (const [key, value] of aliases) {
    if (key.length > 600) invalid();
    relative(JSON.parse(key));
    relative(value);
    total += key.length + JSON.stringify(value).length;
  }
  const title = details.get("titlePage"),
    metadata = details.get("metadata"),
    beats = details.get("beats");
  if (
    !(title instanceof Y.Map) ||
    !(metadata instanceof Y.Map) ||
    !(beats instanceof Y.Map) ||
    beats.size > 1000 ||
    metadata.size > 100
  )
    invalid();
  if ([...title.keys()].some((key) => ![...titleFields, "extra"].includes(key)))
    invalid();
  for (const key of titleFields) {
    text(title.get(key), 100000);
    total += (title.get(key) as Y.Text).length;
  }
  if (title.has("extra")) total += json(title.get("extra"));
  text(metadata.get("notes"), 1000000);
  total += (metadata.get("notes") as Y.Text).length;
  for (const [key, value] of metadata)
    if (key !== "notes") {
      if (
        ["version", "beats", "__proto__", "constructor", "prototype"].includes(
          key,
        )
      )
        invalid();
      total += key.length + json(value);
    }
  for (const [id, beat] of beats) {
    if (
      !id ||
      id.length > 200 ||
      !(beat instanceof Y.Map) ||
      beat.size !== 6 ||
      [...beat.keys()].some(
        (key) =>
          !["title", "description", "color", "act", "order", "range"].includes(
            key,
          ),
      )
    )
      invalid();
    for (const key of ["title", "description"]) {
      text(beat.get(key), 100000);
      total += (beat.get(key) as Y.Text).length;
    }
    for (const key of ["color", "act"])
      if (
        typeof beat.get(key) !== "string" ||
        (beat.get(key) as string).length > 200
      )
        invalid();
    if (
      !Number.isSafeInteger(beat.get("order")) ||
      Number(beat.get("order")) < 0 ||
      Number(beat.get("order")) > 10000
    )
      invalid();
    const range = beat.get("range") as SharedRange | null;
    if (range !== null) {
      if (
        !range ||
        typeof range.empty !== "boolean" ||
        Object.keys(range).some((k) => !["start", "end", "empty"].includes(k))
      )
        invalid();
      relative(range.start);
      relative(range.end);
    }
  }
  if (total > 4 * 1024 * 1024) invalid();
  context(doc).doc.check();
}
