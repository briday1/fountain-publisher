import { Fragment, Schema } from "prosemirror-model";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { BlockKind, ScriptBlock, TextMark, TextSpan } from "../core/model";
import { blockLabels, newId } from "../core/model";

export const screenplaySchema = new Schema({
  nodes: {
    doc: { content: "screenplayBlock+" },
    screenplayBlock: {
      content: "text*",
      group: "block",
      whitespace: "pre",
      defining: true,
      attrs: {
        id: { default: null },
        kind: { default: "action" },
        sceneNumber: { default: null },
        level: { default: 1 },
        dual: { default: false },
        manual: { default: false },
        automatic: { default: false },
        autoFrom: { default: "action" },
      },
      parseDOM: [
        {
          tag: "p[data-kind]",
          getAttrs: (element) => ({
            id: element.getAttribute("data-id")?.slice(0, 200) || newId(),
            kind: Object.hasOwn(
              blockLabels,
              element.getAttribute("data-kind") ?? "",
            )
              ? element.getAttribute("data-kind")
              : "action",
            sceneNumber: element.getAttribute("data-scene-number"),
            level: Number(element.getAttribute("data-level")) || 1,
            dual: element.getAttribute("data-dual") === "true",
          }),
        },
        { tag: "p", getAttrs: () => ({ id: newId() }) },
        { tag: "div", getAttrs: () => ({ id: newId() }) },
        { tag: "h1", getAttrs: () => ({ id: newId(), kind: "section" }) },
        {
          tag: "h2",
          getAttrs: () => ({ id: newId(), kind: "section", level: 2 }),
        },
        { tag: "br", getAttrs: () => ({ id: newId() }) },
      ],
      toDOM(node) {
        return [
          "p",
          {
            "data-kind": node.attrs.kind,
            "data-id": node.attrs.id,
            "data-level": node.attrs.level,
            // Character cues are proper names, not dictionary prose. Other
            // blocks inherit the writer's spellcheck setting from the editor.
            ...(node.attrs.kind === "character" ? { spellcheck: "false" } : {}),
            ...(node.attrs.sceneNumber
              ? { "data-scene-number": node.attrs.sceneNumber }
              : {}),
            ...(node.attrs.dual ? { "data-dual": "true" } : {}),
          },
          0,
        ];
      },
    },
    text: { group: "inline" },
  },
  marks: {
    bold: {
      parseDOM: [
        { tag: "strong" },
        {
          tag: "b",
          getAttrs: (node) => node.style.fontWeight !== "normal" && null,
        },
        { style: "font-weight=bold" },
        { style: "font-weight=700" },
      ],
      toDOM: () => ["strong", 0],
    },
    italic: {
      parseDOM: [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }],
      toDOM: () => ["em", 0],
    },
    underline: {
      parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
      toDOM: () => ["u", 0],
    },
  },
});

export function blockToNode(block: ScriptBlock): ProseMirrorNode {
  const spans =
    block.spans?.length &&
    block.spans.map((span) => span.text).join("") === block.text
      ? block.spans
      : [{ text: block.text }];
  const content = spans
    .filter((span) => span.text)
    .map((span) =>
      screenplaySchema.text(
        span.text,
        (span.marks ?? [])
          .filter((mark) => screenplaySchema.marks[mark])
          .map((mark) => screenplaySchema.marks[mark].create()),
      ),
    );
  return screenplaySchema.nodes.screenplayBlock.create(
    {
      id: block.id || newId(),
      kind: block.kind,
      sceneNumber: block.sceneNumber ?? null,
      level: block.level ?? 1,
      dual: block.dual ?? false,
      manual: block.kind !== "action",
    },
    content,
  );
}

export function blocksToDoc(blocks: ScriptBlock[]): ProseMirrorNode {
  const ids = new Set<string>();
  return screenplaySchema.nodes.doc.create(
    null,
    blocks.length
      ? blocks.map((block) => {
          const id = block.id && !ids.has(block.id) ? block.id : newId();
          ids.add(id);
          return blockToNode({ ...block, id });
        })
      : [blockToNode({ id: newId(), kind: "action", text: "" })],
  );
}

export function docToBlocks(doc: ProseMirrorNode): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  doc.forEach((node) => {
    const spans: TextSpan[] = [];
    node.forEach((text) => {
      const marks = text.marks.map((mark) => mark.type.name as TextMark);
      spans.push({ text: text.text ?? "", ...(marks.length ? { marks } : {}) });
    });
    blocks.push({
      id: node.attrs.id,
      kind: node.attrs.kind as BlockKind,
      text: node.textContent,
      ...(spans.some((span) => span.marks?.length) ? { spans } : {}),
      ...(node.attrs.sceneNumber
        ? { sceneNumber: node.attrs.sceneNumber }
        : {}),
      ...(node.attrs.kind === "section" ? { level: node.attrs.level } : {}),
      ...(node.attrs.dual ? { dual: true } : {}),
    });
  });
  return blocks;
}

export function freshenPastedIds(
  fragment: Fragment,
  usedIds = new Set<string>(),
): Fragment {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(node);
      return;
    }
    const id =
      node.attrs.id && !usedIds.has(node.attrs.id)
        ? (node.attrs.id as string)
        : newId();
    usedIds.add(id);
    nodes.push(
      node.type.create(
        { ...node.attrs, id },
        freshenPastedIds(node.content, usedIds),
        node.marks,
      ),
    );
  });
  return Fragment.from(nodes);
}
