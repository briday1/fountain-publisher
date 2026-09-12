// One dedicated worker per tab. The UI never loads or executes the Python/WASM
// runtime. No network/server fallback is allowed if a worker cannot start.
export function createCompilerWorkerClient({
  createWorker = () => new Worker(new URL("./compiler-worker.mjs", import.meta.url), { type: "module", name: "fountain-local-compiler" }),
  startupTimeoutMs = 180_000,
  jobTimeoutMs = 120_000,
  maxQueuedJobs = 16,
} = {}) {
  let worker = null;
  let ready = false;
  let active = null;
  let queue = [];
  let timer = null;
  let nextId = 0;
  let disposed = false;

  function settle(job, error, result) {
    if (error) job.reject(error);
    else {
      try { job.resolve(job.superseded || !job.isCurrent() ? null : result); }
      catch (cause) { job.reject(cause); }
    }
  }

  function failWorker(error, instance = worker) {
    if (instance !== worker) return;
    clearTimeout(timer);
    timer = null;
    const failed = worker;
    worker = null;
    ready = false;
    const jobs = active ? [active, ...queue] : queue;
    active = null;
    queue = [];
    failed?.terminate();
    for (const job of jobs) settle(job, error);
  }

  function startWorker() {
    try {
      const instance = createWorker();
      worker = instance;
      instance.addEventListener("message", ({ data }) => {
        if (instance !== worker) return;
        if (data?.type === "ready") {
          if (ready) return;
          clearTimeout(timer);
          ready = true;
          pump();
        } else if (data?.type === "fatal") {
          failWorker(new Error(data.error || "Local compiler failed to initialize"), instance);
        } else if (data?.type === "result" && active?.id === data.id) {
          clearTimeout(timer);
          const job = active;
          active = null;
          settle(job, data.error ? new Error(data.error) : null, data.result);
          pump();
        }
      });
      instance.addEventListener("error", (event) => {
        event.preventDefault?.();
        failWorker(new Error(event.message || "Local compiler worker stopped unexpectedly"), instance);
      });
      instance.addEventListener("messageerror", () => failWorker(new Error("Local compiler response could not be read"), instance));
      timer = setTimeout(() => failWorker(new Error("Local compiler initialization timed out. Please try again."), instance), startupTimeoutMs);
      instance.postMessage({ type: "initialize" });
    } catch (error) { failWorker(error); }
  }

  function pump() {
    // Discard cancelled work before loading the engine or crossing threads.
    queue = queue.filter((job) => {
      try {
        if (!job.superseded && job.isCurrent()) return true;
        settle(job, null, null);
      } catch (error) { settle(job, error); }
      return false;
    });
    if (active || !queue.length) return;
    if (!worker) { startWorker(); return; }
    if (!ready) return;
    // Click-time exports/imports take priority over pending automatic previews.
    const explicit = queue.findIndex((job) => !job.backgroundKey);
    active = queue.splice(explicit < 0 ? 0 : explicit, 1)[0];
    const instance = worker;
    timer = setTimeout(() => failWorker(new Error("Local compiler job timed out. Please try again."), instance), jobTimeoutMs);
    try {
      active.onStart?.();
      worker.postMessage({ type: "job", id: active.id, operation: active.operation, input: active.input }, active.transfer);
    } catch (error) { failWorker(error, instance); }
  }

  function enqueue(operation, input, { isCurrent = () => true, backgroundKey = null, onStart } = {}, transfer = []) {
    if (disposed) return Promise.reject(new Error("Local compiler has been closed"));
    return new Promise((resolve, reject) => {
      if (!isCurrent()) { resolve(null); return; }
      if (backgroundKey) {
        // At most one pending job per background consumer. Never cancel exports
        // or terminate an executing engine merely because the user kept typing.
        queue = queue.filter((job) => {
          if (job.backgroundKey !== backgroundKey) return true;
          job.superseded = true;
          settle(job, null, null);
          return false;
        });
        if (active?.backgroundKey === backgroundKey) active.superseded = true;
      }
      if (queue.length >= maxQueuedJobs) { reject(new Error("The local compiler is busy. Wait for the current export and try again.")); return; }
      queue.push({ id: ++nextId, operation, input, isCurrent, backgroundKey, onStart, transfer, resolve, reject, superseded: false });
      pump();
    });
  }

  return {
    compile(kind, input, options) {
      if (kind !== "pdf" && kind !== "fdx") return Promise.reject(new Error(`Unsupported export kind: ${kind}`));
      const request = Object.freeze({
        source: String(input.source),
        pageSize: input.pageSize ?? "letter",
        sceneNumbers: input.sceneNumbers ?? "margin",
        sceneNumberFormat: input.sceneNumberFormat ?? "sequential",
      });
      return enqueue("compile", { kind, request }, options);
    },
    beatSheet(input) {
      return enqueue("beat-sheet", {
        title: String(input.title), premise: String(input.premise),
        beats: input.beats.map(String), pageSize: input.pageSize ?? "letter",
      });
    },
    extractPdf(input) {
      // Own the transferable buffer without detaching the caller's file bytes.
      const bytes = input instanceof ArrayBuffer ? input.slice(0) : new Uint8Array(input).slice().buffer;
      return enqueue("extract-pdf", { bytes }, {}, [bytes]);
    },
    cancelBackground(key) {
      if (!key) return;
      queue = queue.filter((job) => {
        if (job.backgroundKey !== key) return true;
        job.superseded = true;
        settle(job, null, null);
        return false;
      });
      if (active?.backgroundKey === key) active.superseded = true;
      // Never terminate the runtime or interrupt an explicit export/import.
      pump();
    },
    promoteBackground(key) {
      if (!key) return;
      if (active?.backgroundKey === key) active.backgroundKey = null;
      for (const job of queue) if (job.backgroundKey === key) job.backgroundKey = null;
      pump();
    },
    dispose() {
      disposed = true;
      failWorker(new Error("Local compiler has been closed"));
    },
  };
}
