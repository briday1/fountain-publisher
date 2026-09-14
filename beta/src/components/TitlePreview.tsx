import { Pencil } from "lucide-react";
import { hasTitlePage } from "../core/titlePage";
import type { TitlePage } from "../core/model";

export function TitlePreview({
  value,
  onEdit,
}: {
  value: TitlePage;
  onEdit: () => void;
}) {
  if (!hasTitlePage(value)) return null;
  const fields = [
    ["title", value.title],
    ["credit", value.credit],
    ["author", value.author],
    ["source", value.source],
    ["draft-date", value.draftDate],
    ["contact", value.contact],
    ...Object.entries(value.extra ?? {}).map(([key, text]) => [
      `extra-${key}`,
      text,
    ]),
  ];
  return (
    <section className="title-preview" aria-label="Title page preview">
      <span className="title-preview-label" aria-hidden="true">
        Title page
      </span>
      <button
        className="title-preview-edit"
        onClick={onEdit}
        aria-label="Edit title page"
      >
        <Pencil size={12} /> Edit
      </button>
      {fields
        .filter(([, text]) => text.trim())
        .map(([key, text]) => (
          <p key={key} data-title-field={key} onDoubleClick={onEdit}>
            {text}
          </p>
        ))}
    </section>
  );
}
