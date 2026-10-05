import { unzlibSync } from "fflate";
import { fontKeys, type FontBytes } from "./writingFonts";
/** Expand WOFF's lossless table container into the OpenType bytes used by Word. */
export function openTypeBytes(bytes: Uint8Array): Uint8Array {
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (source.getUint32(0) !== 0x774f4646) return bytes.slice();
  const count = source.getUint16(12),
    total = source.getUint32(16);
  if (total > 20_000_000 || 44 + count * 20 > bytes.length)
    throw new Error("Invalid font data.");
  const output = new Uint8Array(total),
    view = new DataView(output.buffer);
  view.setUint32(0, source.getUint32(4));
  view.setUint16(4, count);
  const power = 2 ** Math.floor(Math.log2(count));
  view.setUint16(6, power * 16);
  view.setUint16(8, Math.log2(power));
  view.setUint16(10, count * 16 - power * 16);
  let offset = 12 + count * 16,
    head = -1;
  for (let i = 0; i < count; i++) {
    const w = 44 + i * 20,
      t = 12 + i * 16,
      length = source.getUint32(w + 12),
      compressed = source.getUint32(w + 8),
      start = source.getUint32(w + 4);
    const data = bytes.subarray(start, start + compressed),
      table = compressed < length ? unzlibSync(data) : data;
    if (table.length !== length || offset + length > total)
      throw new Error("Invalid font table.");
    view.setUint32(t, source.getUint32(w));
    view.setUint32(t + 4, source.getUint32(w + 16));
    view.setUint32(t + 8, offset);
    view.setUint32(t + 12, length);
    output.set(table, offset);
    if (source.getUint32(w) === 0x68656164) head = offset;
    offset += (length + 3) & ~3;
  }
  if (head >= 0) {
    view.setUint32(head + 8, 0);
    let sum = 0;
    for (let i = 0; i < output.length; i += 4)
      sum = (sum + view.getUint32(i)) >>> 0;
    view.setUint32(head + 8, (0xb1b0afba - sum) >>> 0);
  }
  return output;
}
export function wordFonts(fonts: FontBytes) {
  return fontKeys.map((style, index) => {
    const key = crypto.randomUUID().toUpperCase(),
      hex = key.replaceAll("-", ""),
      bytes = openTypeBytes(fonts[style]);
    const mask = Uint8Array.from(
      hex
        .match(/../g)!
        .reverse()
        .map((v) => parseInt(v, 16)),
    );
    for (let i = 0; i < 32; i++) bytes[i] ^= mask[i % 16];
    return {
      style,
      key,
      bytes,
      id: `font${index}`,
      file: `font${index}.odttf`,
    };
  });
}
