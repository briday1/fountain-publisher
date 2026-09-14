import type { Screenplay } from "./model";
import type { exportPdf } from "./export";
let worker: Worker | undefined;
let serial = 0;
const jobs = new Map<
  number,
  {
    resolve: (r: {
      bytes: Uint8Array;
      pageCount: number;
      scriptPageCount: number;
      warnings: string[];
    }) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export function publishPdf(
  doc: Screenplay,
  options: Parameters<typeof exportPdf>[1],
): Promise<{
  bytes: Uint8Array;
  pageCount: number;
  scriptPageCount: number;
  warnings: string[];
}> {
  if (!worker) {
    worker = new Worker(new URL("./publish.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      jobs.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data);
    };
    worker.onerror = () => {
      for (const job of jobs.values()) {
        clearTimeout(job.timer);
        job.reject(new Error("PDF publishing stopped. Please try again."));
      }
      jobs.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      jobs.delete(id);
      reject(
        new Error(
          "PDF publishing took too long. Your screenplay is still saved.",
        ),
      );
    }, 120000);
    jobs.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, doc, options });
  });
}
