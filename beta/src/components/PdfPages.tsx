import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

/** Render one real PDF page at a time, without a browser PDF plug-in. */
export function PdfPages({ bytes }: { bytes: Uint8Array }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [working, setWorking] = useState(true);
  const [error, setError] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let destroy: (() => Promise<void>) | undefined;
    setPdf(undefined);
    setPage(1);
    setError("");
    setWorking(true);
    void (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      // PDF.js transfers its buffer to a worker; preserve the publishing cache.
      const task = pdfjs.getDocument({ data: bytes.slice() });
      destroy = () => task.destroy();
      const document = await task.promise;
      if (!disposed) setPdf(document);
    })().catch(() => {
      if (!disposed) {
        setError(
          "These pages could not be displayed. You can still download the PDF above.",
        );
        setWorking(false);
      }
    });
    return () => {
      disposed = true;
      void destroy?.().catch(() => {});
    };
  }, [bytes]);
  useEffect(() => {
    if (!pdf || !width) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setWorking(true);
    setError("");
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (disposed) return;
      const original = sheet.getViewport({ scale: 1 });
      const scale = Math.min(Math.max(width - 24, 1), 1000) / original.width;
      const dimensions = sheet.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(dimensions.width * density);
      canvas.height = Math.ceil(dimensions.height * density);
      canvas.style.width = `${dimensions.width}px`;
      canvas.style.height = `${dimensions.height}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `PDF page ${page} of ${pdf.numPages}`);
      task = sheet.render({
        canvas,
        viewport: dimensions,
        transform: [density, 0, 0, density, 0, 0],
      });
      await task.promise;
      if (disposed) return;
      surface.current?.replaceChildren(canvas);
      viewport.current?.scrollTo(0, 0);
      setWorking(false);
    })().catch(() => {
      if (!disposed) {
        setError(
          "This page could not be displayed. Try another page or download the PDF above.",
        );
        setWorking(false);
      }
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, page, width]);
  return (
    <div className="pdf-pages">
      <nav className="pdf-page-controls" aria-label="PDF page navigation">
        <button disabled={!pdf || page <= 1} onClick={() => setPage(page - 1)}>
          Previous page
        </button>
        <span aria-live="polite">
          {pdf ? `Page ${page} of ${pdf.numPages}` : "Loading PDF…"}
        </span>
        <button
          disabled={!pdf || page >= pdf.numPages}
          onClick={() => setPage(page + 1)}
        >
          Next page
        </button>
      </nav>
      <div className="pdf-page-viewport" ref={viewport} aria-busy={working}>
        {working && <p role="status">Rendering page…</p>}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div ref={surface} hidden={working || !!error} />
      </div>
    </div>
  );
}
