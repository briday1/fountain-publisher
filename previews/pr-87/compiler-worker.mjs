import { createCompilerEngine } from "./compiler-runtime.mjs";

// A dedicated browser worker, not a Cloudflare Worker or shared worker. Runtime
// initialization and all PDF/FDX/import work stay entirely inside this tab.
export function attachCompilerWorker(scope, engine = createCompilerEngine()) {
  let initialization = null;
  let tail = Promise.resolve();
  const message = (error) => error instanceof Error ? error.message : String(error);
  const initialize = () => initialization ??= Promise.resolve().then(() => engine.initialize());
  scope.addEventListener("message", ({ data }) => {
    if (data?.type === "initialize") {
      initialize().then(
        () => scope.postMessage({ type: "ready" }),
        (error) => scope.postMessage({ type: "fatal", error: message(error) }),
      );
    } else if (data?.type === "job" && Number.isSafeInteger(data.id)) {
      tail = tail.then(async () => {
        try {
          await initialize();
          const result = await engine.execute(data.operation, data.input);
          scope.postMessage({ type: "result", id: data.id, result });
        } catch (error) { scope.postMessage({ type: "result", id: data.id, error: message(error) }); }
      }).catch((error) => scope.postMessage({ type: "fatal", error: message(error) }));
    }
  });
}

if (typeof self !== "undefined" && typeof self.document === "undefined") attachCompilerWorker(self);
