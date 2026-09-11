import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FileText, ArrowUpRight, Loader2 } from "lucide-react";
GlobalWorkerOptions.workerSrc = workerUrl;
export function PdfViewer({
  pdf,
  zoom,
  onPages,
  onPage,
  emptyAction,
  sample,
}: {
  pdf: string | null;
  zoom: number;
  onPages: (count: number) => void;
  onPage: (page: number) => void;
  emptyAction: () => void;
  sample: boolean;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(560);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width - 56),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setError("");
    setDocument(null);
    if (!pdf) {
      onPages(0);
      return;
    }
    const data = Uint8Array.from(atob(pdf), (character) =>
      character.charCodeAt(0),
    );
    const task = getDocument({ data, useSystemFonts: true });
    let alive = true;
    task.promise
      .then((doc) => {
        if (alive) {
          setDocument(doc);
          onPages(doc.numPages);
        }
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
      void task.destroy();
    };
  }, [pdf]);
  useEffect(() => {
    const element = container.current;
    if (!element || !document) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            onPage(Number((entry.target as HTMLElement).dataset.page));
      },
      { root: element, threshold: 0.3 },
    );
    element
      .querySelectorAll(".pdf-sheet")
      .forEach((sheet) => observer.observe(sheet));
    return () => observer.disconnect();
  }, [document, onPage]);
  return (
    <div className="pdf-scroll" ref={container} data-testid="pdf-viewer">
      {!pdf ? (
        <div className="pdf-empty">
          <div className="empty-paper">
            <FileText size={38} strokeWidth={1} />
          </div>
          <h3>Your words, beautifully set.</h3>
          <p>Compile your document to bring the page to life.</p>
          <button className="button primary" onClick={emptyAction}>
            Compile document <ArrowUpRight size={15} />
          </button>
          <span>Your PDF is created on this device.</span>
        </div>
      ) : error ? (
        <div className="pdf-empty">
          <h3>We couldn’t display this PDF.</h3>
          <p>{error}</p>
          <button className="button" onClick={emptyAction}>
            Recompile document
          </button>
        </div>
      ) : !document ? (
        <div className="pdf-empty">
          <Loader2 className="spin" />
          <p>Setting the page…</p>
        </div>
      ) : (
        <>
          {sample && (
            <div className="sample-label">
              Template preview <span>·</span> Recompile to see your changes
            </div>
          )}
          {Array.from({ length: document.numPages }, (_, i) => (
            <PdfPage
              key={i}
              document={document}
              page={i + 1}
              width={(Math.max(180, width) * zoom) / 100}
            />
          ))}
          <div className="pdf-end">A little more space to think.</div>
        </>
      )}
    </div>
  );
}
function PdfPage({
  document,
  page,
  width,
}: {
  document: PDFDocumentProxy;
  page: number;
  width: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [height, setHeight] = useState(width * 1.414);
  useEffect(() => {
    let alive = true;
    let render: RenderTask | undefined;
    void document
      .getPage(page)
      .then(async (sheet) => {
        if (!alive || !canvas.current) return;
        const original = sheet.getViewport({ scale: 1 });
        const viewport = sheet.getViewport({ scale: width / original.width });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const el = canvas.current;
        el.width = viewport.width * ratio;
        el.height = viewport.height * ratio;
        setHeight(viewport.height);
        const context = el.getContext("2d")!;
        render = sheet.render({
          canvas: el,
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        try {
          await render.promise;
        } catch (error) {
          if ((error as Error).name !== "RenderingCancelledException")
            console.error(error);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      render?.cancel();
    };
  }, [document, page, width]);
  return (
    <div
      className="pdf-sheet"
      data-page={page}
      id={`pdf-page-${page}`}
      style={{ width, height }}
    >
      <canvas
        ref={canvas}
        style={{ width, height }}
        aria-label={`PDF page ${page}`}
      />
    </div>
  );
}
