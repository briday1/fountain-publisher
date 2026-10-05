/** Suggest a distinct sibling name while preserving the document extension. */
export function availableCopyName(
  item: { name: string; kind: "file" | "folder" },
  siblings: { name: string }[],
) {
  const dot = item.kind === "file" ? item.name.lastIndexOf(".") : -1;
  const extension = dot > 0 ? item.name.slice(dot) : "";
  const stem = (dot > 0 ? item.name.slice(0, dot) : item.name).replace(
    / copy(?: \d+)?$/i,
    "",
  );
  const existing = new Set(siblings.map((i) => i.name.toLocaleLowerCase()));
  for (let number = 1; ; number++) {
    const suffix = number === 1 ? " copy" : ` copy ${number}`;
    const name =
      stem.slice(0, 160 - suffix.length - extension.length) +
      suffix +
      extension;
    if (!existing.has(name.toLocaleLowerCase())) return name;
  }
}
