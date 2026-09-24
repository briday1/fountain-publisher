export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function sameOrigin(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    throw new HttpError(403, "Invalid request origin.");
}
export async function bodyJson(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  const raw = await request.text();
  if (raw.length > 4096) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export const now = () => Math.floor(Date.now() / 1000);
