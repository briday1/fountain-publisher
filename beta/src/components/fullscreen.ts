type SafariDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type SafariElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
export function fullscreenElement(doc: Document = document) {
  return (
    doc.fullscreenElement || (doc as SafariDocument).webkitFullscreenElement
  );
}
export async function setBrowserFullscreen(
  enabled: boolean,
  doc: Document = document,
) {
  const win = doc.defaultView;
  // Installed web apps already own their window. iPadOS may omit both
  // fullscreen APIs here, so neither entering nor exiting should call them.
  if (
    (win?.navigator as (Navigator & { standalone?: boolean }) | undefined)
      ?.standalone === true ||
    win?.matchMedia?.("(display-mode: standalone)").matches ||
    win?.matchMedia?.("(display-mode: fullscreen)").matches
  )
    return;
  if (enabled === !!fullscreenElement(doc)) return;
  if (enabled) {
    const element = doc.documentElement as SafariElement;
    if (element.requestFullscreen)
      await element.requestFullscreen({ navigationUI: "hide" });
    else if (element.webkitRequestFullscreen)
      await element.webkitRequestFullscreen();
    else throw new Error("Full screen is unavailable in this browser.");
  } else if (doc.exitFullscreen) await doc.exitFullscreen();
  else await (doc as SafariDocument).webkitExitFullscreen?.();
}
