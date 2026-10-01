/** Bounded, in-memory technical facts only. Never store document text or raw errors. */
type Event = {
  time: string;
  area: string;
  status?: number;
  reference?: string;
};
const events: Event[] = [];
export const supportAddress = "writeshape-support@agentmail.to";
export function recordDiagnostic(
  area: string,
  status?: number,
  reference?: unknown,
) {
  events.push({
    time: new Date().toISOString(),
    area: /^[a-z-]{1,32}$/.test(area) ? area : "app",
    status,
    ...(typeof reference === "string" && /^[a-f0-9-]{36}$/i.test(reference)
      ? { reference }
      : {}),
  });
  if (events.length > 20) events.shift();
}
export function diagnosticSnapshot(context: {
  destination: string;
  sync: string;
  premium: boolean;
}) {
  return {
    version: 1,
    time: new Date().toISOString(),
    build:
      document
        .querySelector<HTMLScriptElement>('script[type="module"][src]')
        ?.src.split("/")
        .pop()
        ?.split("?")[0] || "development",
    browser: navigator.userAgent,
    viewport: `${innerWidth}×${innerHeight}`,
    online: navigator.onLine,
    display: matchMedia("(display-mode: standalone)").matches
      ? "installed"
      : "browser",
    ...context,
    events: [...events],
  };
}
