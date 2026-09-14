import "dotenv/config";
import { resolve } from "node:path";
import { createApp } from "./app";
const provider = (
  clientId: string | undefined,
  clientSecret: string | undefined,
) => (clientId && clientSecret ? { clientId, clientSecret } : undefined);
const port = Number(process.env.PORT ?? 5174);
const production = process.env.NODE_ENV === "production";
const { app } = await createApp({
  origin:
    process.env.APP_ORIGIN ??
    (production ? `http://127.0.0.1:${port}` : "http://127.0.0.1:5173"),
  dataDirectory: resolve(process.env.DATA_DIRECTORY ?? ".data"),
  encryptionKey: process.env.DATA_ENCRYPTION_KEY,
  production,
  github: provider(
    process.env.GITHUB_CLIENT_ID,
    process.env.GITHUB_CLIENT_SECRET,
  ),
  google: provider(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  ),
});
const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  console.log(`Fountain Publisher server listening on port ${port}.`);
});
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
