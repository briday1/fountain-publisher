import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
export type Provider = "github" | "google";
export interface Credential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  account?: string;
}
export interface Session {
  id: string;
  csrf: string;
  expiresAt: number;
  credentials: Partial<Record<Provider, Credential>>;
  oauth?: {
    provider: Provider;
    state: string;
    verifier: string;
    expiresAt: number;
  };
}
export class SessionVault {
  readonly sessions = new Map<string, Session>();
  private key!: Buffer;
  private writes: Promise<void> = Promise.resolve();
  constructor(
    private directory: string,
    private encryptionKey?: string,
  ) {}
  async open() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (this.encryptionKey) {
      this.key = Buffer.from(this.encryptionKey, "hex");
      if (this.key.length !== 32 || !/^[a-f0-9]{64}$/i.test(this.encryptionKey))
        throw new Error(
          "DATA_ENCRYPTION_KEY must be 64 hexadecimal characters.",
        );
    } else {
      const keyFile = join(this.directory, "key");
      try {
        this.key = await readFile(keyFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const key = randomBytes(32);
        try {
          await writeFile(keyFile, key, { flag: "wx", mode: 0o600 });
          this.key = key;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          this.key = await readFile(keyFile);
        }
      }
    }
    if (this.key.length !== 32)
      throw new Error("Invalid credential encryption key.");
    try {
      const encrypted = await readFile(join(this.directory, "sessions.enc"));
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        encrypted.subarray(0, 12),
      );
      decipher.setAuthTag(encrypted.subarray(12, 28));
      const plain = Buffer.concat([
        decipher.update(encrypted.subarray(28)),
        decipher.final(),
      ]);
      const sessions = JSON.parse(plain.toString()) as Session[];
      for (const session of sessions)
        if (session.expiresAt > Date.now())
          this.sessions.set(session.id, session);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error(
          "Could not decrypt saved sessions. Preserve the data directory and check its encryption key.",
        );
    }
  }
  create(): Session {
    for (const [id, session] of this.sessions)
      if (session.expiresAt < Date.now()) this.sessions.delete(id);
    if (this.sessions.size >= 1000)
      throw new Error("Session capacity reached.");
    const session: Session = {
      id: randomBytes(32).toString("hex"),
      csrf: randomBytes(32).toString("hex"),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      credentials: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }
  persist(): Promise<void> {
    const run = async () => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify([...this.sessions.values()])),
        cipher.final(),
      ]);
      const temporary = join(
        this.directory,
        `sessions-${randomBytes(8).toString("hex")}.tmp`,
      );
      await writeFile(
        temporary,
        Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
        { mode: 0o600 },
      );
      await rename(temporary, join(this.directory, "sessions.enc"));
    };
    this.writes = this.writes.catch(() => {}).then(run);
    return this.writes;
  }
}
