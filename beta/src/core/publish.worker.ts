import { exportPdf } from "./export";
import type { Screenplay } from "./model";
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    doc: Screenplay;
    options: Parameters<typeof exportPdf>[1];
  }>,
) => {
  const { id, doc, options } = event.data;
  try {
    const { bytes, pageCount, scriptPageCount, warnings } = await exportPdf(
      doc,
      options,
    );
    self.postMessage(
      { id, bytes, pageCount, scriptPageCount, warnings },
      { transfer: [bytes.buffer as ArrayBuffer] },
    );
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error ? error.message : "The PDF could not be built.",
    });
  }
};
