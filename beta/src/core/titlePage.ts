import type { TitlePage } from "./model";

/** A default credit alone does not create a title page for a blank screenplay. */
export function hasTitlePage(title: TitlePage): boolean {
  return [
    title.title,
    title.author,
    title.source,
    title.draftDate,
    title.contact,
    ...Object.values(title.extra ?? {}),
  ].some((value) => value.trim().length > 0);
}

export function titlePageExtra(title: TitlePage, name: string): string {
  return (
    Object.entries(title.extra ?? {}).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    )?.[1] ?? ""
  );
}

export function withTitlePageExtra(
  title: TitlePage,
  name: string,
  value: string,
): TitlePage {
  const extra = Object.fromEntries(
    Object.entries(title.extra ?? {}).filter(
      ([key]) => key.toLowerCase() !== name.toLowerCase(),
    ),
  );
  if (value) extra[name] = value;
  return { ...title, extra };
}
