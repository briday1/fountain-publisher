import { isNovel } from "./markdown";
import { novelPdf } from "./novelExport";
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
    const { bytes, pageCount, scriptPageCount, pageEquivalent, warnings } =
      await (isNovel(doc) ? novelPdf(doc,options) : exportPdf(doc, options));
    self.postMessage(
      { id, bytes, pageCount, scriptPageCount, pageEquivalent, warnings },
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
