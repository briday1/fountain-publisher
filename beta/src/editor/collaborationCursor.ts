/** The collaboration preview and actual writers use the identical inline marker. */
export function collaborationCursor(
  user: { name?: string; color?: string },
  clientId?: number,
) {
  const cursor = document.createElement("span");
  cursor.className = "collaboration-cursor";
  if (clientId !== undefined) cursor.dataset.clientId = String(clientId);
  cursor.setAttribute("aria-hidden", "true");
  const color = /^#[0-9a-f]{6}$/i.test(user.color ?? "")
    ? user.color!
    : "#7762bd";
  cursor.style.borderColor = color;
  const label = document.createElement("span");
  label.textContent = String(user.name || "Writer").slice(0, 100);
  label.style.backgroundColor = color;
  cursor.append(label);
  return cursor;
}
