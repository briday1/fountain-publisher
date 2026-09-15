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
