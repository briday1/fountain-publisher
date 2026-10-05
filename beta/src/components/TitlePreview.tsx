import { Pencil } from "lucide-react";
import { hasTitlePage, titlePageExtra } from "../core/titlePage";
import type { TitlePage } from "../core/model";

export function TitlePreview({
  value,
  onEdit,
  novel = false,
}: {
  novel?: boolean;
  value: TitlePage;
  onEdit: () => void;
}) {
  if (novel)
    return (
      <section className="book-front-matter" aria-label="Book title page">
        <button
          className="title-preview-edit"
          onClick={onEdit}
          aria-label="Edit title page"
        >
          <Pencil size={12} /> Edit
        </button>
        {value.title ? (
          <h1>{value.title}</h1>
        ) : (
          <button className="book-title-placeholder" onClick={onEdit}>
            Add a title
          </button>
        )}
        {value.author ? (
          <p className="book-author">{value.author}</p>
        ) : (
          <button className="book-author-placeholder" onClick={onEdit}>
            Add author
          </button>
        )}
        {titlePageExtra(value, "Dedication") && (
          <p className="book-dedication">
            {titlePageExtra(value, "Dedication")}
          </p>
        )}
      </section>
    );
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
