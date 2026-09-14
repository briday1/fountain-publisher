export function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeBytes(value: string): Uint8Array {
  if (typeof value !== "string" || value.length > 24_000_000)
    throw new Error("Invalid live document data.");
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
