import test from "node:test";
import assert from "node:assert/strict";
import { hkdfSync, createDecipheriv } from "node:crypto";
import { generateDocumentSecret, createDocumentCipher } from "../../experimental/e2ee/document-crypto.mjs";

const context = { fileId: "test-drive-file-id", documentId: "a".repeat(48), epoch: 1 };
const bytes = value => new TextEncoder().encode(value);
const string = value => new TextDecoder().decode(value);
const change = encoded => {
  const decoded = Buffer.from(encoded, "base64url");
  decoded[0] ^= 1;
  return decoded.toString("base64url");
};

test("document secrets contain 256 random bits and are not reused", () => {
  const secrets = new Set(Array.from({ length: 64 }, generateDocumentSecret));
  assert.equal(secrets.size, 64);
  for (const secret of secrets) {
    assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(secret, "base64url").length, 32);
  }
});

test("snapshot, Yjs-update bytes, and presence round-trip with fresh IDs and nonces", async () => {
  const cipher = await createDocumentCipher(generateDocumentSecret(), context);
  for (const purpose of ["snapshot", "update", "presence"]) {
    for (const content of [new Uint8Array(), bytes("INT. CAFÉ — DAY\nPrivate screenplay 👋"), new Uint8Array([0, 255, 1, 128])]) {
      const first = await cipher.seal(purpose, content);
      const second = await cipher.seal(purpose, content);
      assert.notEqual(first.id, second.id);
      assert.notEqual(first.iv, second.iv);
      assert.notEqual(first.ciphertext, second.ciphertext);
      assert.deepEqual(await cipher.open(purpose, JSON.parse(JSON.stringify(first))), content);
      assert.ok(!JSON.stringify(first).includes("Private screenplay"));
    }
  }
});

test("the envelope interoperates with an independent Node HKDF/AES-GCM implementation", async () => {
  const secret = generateDocumentSecret();
  const cipher = await createDocumentCipher(secret, context);
  const record = await cipher.seal("snapshot", bytes("Interoperable content"));
  const aad = Buffer.from(JSON.stringify(["fountain-publisher-e2ee", 1, context.fileId, context.documentId, 1, "snapshot", record.id]));
  const derived = hkdfSync("sha256", Buffer.from(secret, "base64url"), Buffer.from("fountain-publisher-e2ee:v1"), aad, 32);
  const decipher = createDecipheriv("aes-256-gcm", derived, Buffer.from(record.iv, "base64url"));
  const ciphertext = Buffer.from(record.ciphertext, "base64url");
  decipher.setAAD(aad);
  decipher.setAuthTag(ciphertext.subarray(-16));
  assert.equal(Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString(), "Interoperable content");
});

test("wrong keys, file IDs, document IDs, and key epochs cannot decrypt", async () => {
  const secret = generateDocumentSecret();
  const cipher = await createDocumentCipher(secret, context);
  const record = await cipher.seal("snapshot", bytes("Secret"));
  for (const [key, other] of [
    [generateDocumentSecret(), context],
    [secret, { ...context, fileId: "copied-drive-file-id" }],
    [secret, { ...context, documentId: "b".repeat(48) }],
    [secret, { ...context, epoch: 2 }],
  ]) {
    const wrong = await createDocumentCipher(key, other);
    await assert.rejects(wrong.open("snapshot", record));
  }
  const rotated = await createDocumentCipher(secret, { ...context, epoch: 2 });
  await assert.rejects(rotated.open("snapshot", { ...record, epoch: 2 }));
});

test("tampered ciphertext, tags, nonces, message IDs, versions, and purposes fail closed", async () => {
  const cipher = await createDocumentCipher(generateDocumentSecret(), context);
  const record = await cipher.seal("update", bytes("Sensitive update"));
  for (const altered of [
    { ciphertext: change(record.ciphertext) },
    { ciphertext: Buffer.from(record.ciphertext, "base64url").subarray(0, -1).toString("base64url") },
    { iv: change(record.iv) }, { id: change(record.id) },
    { version: 2 }, { format: "other-format" }, { epoch: 2 }, { purpose: "presence" },
  ]) await assert.rejects(cipher.open("update", { ...record, ...altered }));
  await assert.rejects(cipher.open("presence", { ...record, purpose: "presence" }));
});

test("strict envelope parsing rejects missing/unknown fields, noncanonical encoding, and excessive input", async () => {
  const cipher = await createDocumentCipher(generateDocumentSecret(), context);
  const record = await cipher.seal("presence", bytes("cursor"));
  const missing = { ...record }; delete missing.iv;
  for (const malformed of [
    null, [], "plaintext", missing, { ...record, plaintext: "oops" },
    { ...record, version: "1" }, { ...record, epoch: "1" },
    { ...record, iv: "A" }, { ...record, iv: `${record.iv}=` },
    { ...record, ciphertext: "A".repeat(6000) },
    { ...record, id: "!".repeat(22) }, { ...record, ciphertext: "" },
  ]) await assert.rejects(cipher.open("presence", malformed));
  await assert.rejects(cipher.seal("presence", new Uint8Array(4097)));
  await assert.rejects(cipher.seal("update", new Uint8Array(65_537)));
  await assert.rejects(cipher.seal("snapshot", new Uint8Array(5_000_001)));
  await assert.rejects(cipher.seal("unknown", bytes("x")));
  await assert.rejects(cipher.seal("snapshot", "plaintext must be explicit bytes"));
});

test("password strings and malformed identity contexts are not accepted as document keys", async () => {
  for (const key of ["password", "", "a".repeat(42), "a".repeat(44), `${generateDocumentSecret()}=`]) {
    await assert.rejects(createDocumentCipher(key, context));
  }
  for (const other of [null, {}, { ...context, fileId: "../file" }, { ...context, epoch: 0 }, { ...context, epoch: 1.5 }, { ...context, epoch: 2 ** 31 }]) {
    await assert.rejects(createDocumentCipher(generateDocumentSecret(), other));
  }
});

test("caller mutations during async crypto cannot change the bound context, record, or plaintext", async () => {
  const secret = generateDocumentSecret();
  const mutableContext = { ...context };
  const creating = createDocumentCipher(secret, mutableContext);
  mutableContext.fileId = "some-other-file-id";
  const cipher = await creating;
  const plaintext = bytes("original");
  const sealing = cipher.seal("snapshot", plaintext);
  plaintext.fill(0);
  const record = { ...await sealing };
  const opening = cipher.open("snapshot", record);
  record.ciphertext = "garbage";
  assert.equal(string(await opening), "original");
  const reopened = await createDocumentCipher(secret, context);
  assert.equal(string(await reopened.open("snapshot", await sealing)), "original");
});
