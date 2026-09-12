import { parentPort } from "node:worker_threads";
import { attachCompilerWorker } from "../src/fountain_publisher/web/compiler-worker.mjs";
import { createCompilerEngine } from "../src/fountain_publisher/web/compiler-runtime.mjs";
import { loadNodeCompilerRuntime } from "./compiler-node-runtime.mjs";

let runtimePromise;
const engine = createCompilerEngine(() => runtimePromise ??= loadNodeCompilerRuntime());
attachCompilerWorker({
  addEventListener(type, listener) {
    if (type === "message") parentPort.on("message", (data) => listener({ data }));
  },
  postMessage(data) { parentPort.postMessage(data); },
}, engine);
