// Regex execution belongs exclusively to a disposable dedicated worker. Killing
// a timed-out/superseded worker also stops catastrophic-backtracking expressions.
export function createSearchClient({
  workerFactory = () => new Worker(new URL("./search-worker.mjs", import.meta.url), { type: "module", name: "fountain-document-search" }),
  timeoutMs = 1_000,
  startupTimeoutMs = 5_000,
} = {}) {
  let worker = null;
  let ready = false;
  let pending = null;
  let timer = null;
  let nextId = 0;
  let disposed = false;

  function error(message, name = "Error") { return Object.assign(new Error(message), { name }); }

  function stop(cause, instance = worker) {
    if (instance !== worker) return;
    clearTimeout(timer);
    timer = null;
    const stopped = worker;
    worker = null;
    ready = false;
    const rejected = pending;
    pending = null;
    stopped?.terminate();
    rejected?.reject(cause);
  }

  function dispatch() {
    if (!worker || !ready || !pending || pending.sent) return;
    pending.sent = true;
    const instance = worker;
    clearTimeout(timer);
    timer = setTimeout(() => stop(error("Search took too long and was stopped. Simplify the regular expression or narrow the search.", "SearchTimeoutError"), instance), timeoutMs);
    try { worker.postMessage({ id: pending.id, task: pending.task, payload: pending.payload }); }
    catch (cause) { stop(cause, instance); }
  }

  function initialize() {
    try {
      const instance = workerFactory();
      worker = instance;
      instance.addEventListener("message", ({ data }) => {
        if (instance !== worker) return;
        if (data?.type === "ready") {
          if (ready) return;
          ready = true;
          clearTimeout(timer);
          dispatch();
        } else if (pending?.id === data?.id) {
          clearTimeout(timer);
          timer = null;
          const completed = pending;
          pending = null;
          if (Object.hasOwn(data, "error")) completed.reject(error(String(data.error)));
          else completed.resolve(data.result);
        }
      });
      instance.addEventListener("error", (event) => {
        event.preventDefault?.();
        stop(error(event.message || "The search worker stopped unexpectedly. Try the search again."), instance);
      });
      instance.addEventListener("messageerror", () => stop(error("The search worker returned an unreadable response. Try again."), instance));
      timer = setTimeout(() => stop(error("The search worker could not start. Reload the page and try again.", "SearchTimeoutError"), instance), startupTimeoutMs);
    } catch (cause) { stop(cause); }
  }

  function cancel() {
    if (pending) stop(error("Search cancelled", "AbortError"));
  }

  return {
    run(task, payload) {
      if (disposed) return Promise.reject(error("Search has been closed", "AbortError"));
      cancel();
      if (!["search", "ex", "parse-ex"].includes(task)) return Promise.reject(error(`Unknown search task: ${task}`));
      return new Promise((resolve, reject) => {
        // Capture arrays and settings as well as the immutable source string.
        const snapshot = structuredClone(payload);
        pending = { id: ++nextId, task, payload: snapshot, resolve, reject, sent: false };
        if (!worker) initialize();
        else dispatch();
      });
    },
    cancel,
    dispose() {
      disposed = true;
      stop(error("Search has been closed", "AbortError"));
    },
  };
}
