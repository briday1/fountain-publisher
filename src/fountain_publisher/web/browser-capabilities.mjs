export function mobileShareFile(blob, filename, {
  mobileLayout,
  navigatorObject,
  FileConstructor,
}) {
  if (
    !mobileLayout
    || typeof FileConstructor !== "function"
    || typeof navigatorObject?.canShare !== "function"
    || typeof navigatorObject?.share !== "function"
  ) return null;

  try {
    const file = new FileConstructor([blob], filename, { type: blob.type });
    return navigatorObject.canShare({ files: [file] }) ? file : null;
  } catch {
    return null;
  }
}
