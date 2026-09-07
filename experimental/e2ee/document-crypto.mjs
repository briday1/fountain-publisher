// Experimental protocol primitive, NOT connected to the editor or Worker.
// See docs/end-to-end-encryption.md before using. Never supply a password here:
// the secret must be an independently generated, uniformly random 256-bit key.

const FORMAT = "fountain-publisher-e2ee";
const VERSION = 1;
const encoder = new TextEncoder();
const LIMITS = Object.freeze({ snapshot: 5_000_000, update: 65_536, presence: 4096 });
const FIELDS = ["format", "version", "epoch", "purpose", "id", "iv", "ciphertext"];

function encode(bytes) {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value, minimum, maximum) {
  if (typeof value !== "string" || value.length > Math.ceil(maximum * 4 / 3)
      || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encrypted record encoding");
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
  if (bytes.length < minimum || bytes.length > maximum || encode(bytes) !== value) {
    throw new Error("Invalid encrypted record encoding");
  }
  return bytes;
}

function random(bytes) {
  return crypto.getRandomValues(new Uint8Array(bytes));
}

export function generateDocumentSecret() {
  const bytes = random(32);
  try { return encode(bytes); } finally { bytes.fill(0); }
}

export async function createDocumentCipher(secret, context) {
  // Snapshot caller-owned context before the first await.
  const { fileId, documentId, epoch } = context || {};
  if (typeof fileId !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)
      || typeof documentId !== "string" || !/^[a-f0-9]{48}$/.test(documentId)
      || !Number.isSafeInteger(epoch) || epoch < 1 || epoch > 2 ** 31 - 1) {
    throw new Error("Invalid document encryption context");
  }
  const raw = decode(secret, 32, 32);
  let master;
  try { master = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]); }
  finally { raw.fill(0); }

  function header(purpose, id) {
    // A fixed-order array prevents ambiguous concatenation or object key order.
    // File IDs come from the authorized open operation, never from ciphertext.
    return encoder.encode(JSON.stringify([FORMAT, VERSION, fileId, documentId, epoch, purpose, id]));
  }

  function recordKey(additionalData) {
    // Each random record ID creates a separate non-extractable AES key. The
    // purpose, file and epoch are separated by HKDF as well as authenticated AAD.
    return crypto.subtle.deriveKey({
      name: "HKDF", hash: "SHA-256",
      salt: encoder.encode(`${FORMAT}:v${VERSION}`), info: additionalData,
    }, master, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  function limit(purpose) {
    if (typeof purpose !== "string" || !Object.hasOwn(LIMITS, purpose)) throw new Error("Invalid encrypted record purpose");
    return LIMITS[purpose];
  }

  return Object.freeze({
    async seal(purpose, plaintext) {
      const maximum = limit(purpose);
      if (!(plaintext instanceof Uint8Array) || plaintext.length > maximum) {
        throw new Error("Invalid encrypted record size");
      }
      const bytes = new Uint8Array(plaintext);
      const id = encode(random(16));
      const iv = random(12);
      const additionalData = header(purpose, id);
      try {
        const key = await recordKey(additionalData);
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, bytes);
        return Object.freeze({ format: FORMAT, version: VERSION, epoch, purpose, id, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
      } finally { bytes.fill(0); }
    },

    async open(purpose, record) {
      const maximum = limit(purpose);
      if (!record || typeof record !== "object" || Array.isArray(record)
          || Object.keys(record).length !== FIELDS.length || !FIELDS.every(field => Object.hasOwn(record, field))) {
        throw new Error("Invalid encrypted record");
      }
      const { format, version, epoch: recordEpoch, purpose: recordPurpose, id, iv, ciphertext } = record;
      if (format !== FORMAT || version !== VERSION || recordEpoch !== epoch || recordPurpose !== purpose) {
        throw new Error("Invalid encrypted record context");
      }
      decode(id, 16, 16);
      const nonce = decode(iv, 12, 12);
      const encrypted = decode(ciphertext, 16, maximum + 16);
      const additionalData = header(purpose, id);
      try {
        const key = await recordKey(additionalData);
        return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData, tagLength: 128 }, key, encrypted));
      } catch {
        // No plaintext or secret-bearing low-level exception is exposed.
        throw new Error("Unable to decrypt: wrong key, document context, or damaged record");
      }
    },
  });
}
