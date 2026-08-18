import { ensurePdfJsRuntimeCompat } from './attachmentPdfRuntimeCompat';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfJsWorkerModule = typeof import('pdfjs-dist/legacy/build/pdf.worker.mjs');
type PdfWorkerUrlModule = typeof import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
type GlobalWithPdfJsWorker = typeof globalThis & {
  pdfjsWorker?: {
    WorkerMessageHandler?: PdfJsWorkerModule['WorkerMessageHandler'];
  };
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsWorkerModulePromise: Promise<PdfJsWorkerModule> | null = null;
let pdfWorkerUrlPromise: Promise<PdfWorkerUrlModule> | null = null;

export const MAX_PDF_VISUAL_PAGES = 12;
const PDF_PAGE_RENDER_MAX_EDGE = 1600;
const PDF_PAGE_JPEG_QUALITY = 0.84;

function shouldForceMainThreadPdfWorker() {
  return (
    typeof (Array.prototype as { at?: unknown }).at !== 'function'
    || typeof (Uint8Array.prototype as { at?: unknown }).at !== 'function'
    || typeof (String.prototype as { at?: unknown }).at !== 'function'
    || typeof (globalThis as { structuredClone?: unknown }).structuredClone !== 'function'
  );
}

async function loadPdfWorkerUrl() {
  pdfWorkerUrlPromise ??= import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
  return (await pdfWorkerUrlPromise).default;
}

async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    const shouldForceFakeWorker = shouldForceMainThreadPdfWorker();
    ensurePdfJsRuntimeCompat();
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then(async (pdfjs) => {
        if (shouldForceFakeWorker) {
          pdfJsWorkerModulePromise ??= import('pdfjs-dist/legacy/build/pdf.worker.mjs');
          const workerModule = await pdfJsWorkerModulePromise;
          const runtime = globalThis as GlobalWithPdfJsWorker;
          runtime.pdfjsWorker = {
            ...(runtime.pdfjsWorker ?? {}),
            WorkerMessageHandler: workerModule.WorkerMessageHandler
          };
        }

        if (!shouldForceFakeWorker && !pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
          pdfjs.GlobalWorkerOptions.workerSrc = await loadPdfWorkerUrl();
        }
        return pdfjs;
      });
  }

  return await pdfJsModulePromise;
}

function normalizePdfChunk(value: string) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ');
}

function shouldInsertPdfSpace(line: string, nextChunk: string) {
  const left = line.charAt(line.length - 1);
  const right = nextChunk[0];
  if (!left || !right) return false;
  if (/\s/.test(left) || /\s/.test(right)) return false;
  if (/[([{/"'“‘-]$/.test(line)) return false;
  if (/^[)\]}.,;:!?/"'”’-]/.test(nextChunk)) return false;
  if (/[\u4e00-\u9fff]$/.test(line) || /^[\u4e00-\u9fff]/.test(nextChunk)) return false;
  return true;
}

function flushPdfLine(target: string[], line: string) {
  const normalized = line.replace(/[ \t]+/g, ' ').trim();
  if (normalized) {
    target.push(normalized);
  }
}

function createPdfLoadingTask(pdfjs: PdfJsModule, buffer: ArrayBuffer) {
  const documentOptions = {
    data: new Uint8Array(buffer.slice(0)),
    isEvalSupported: false,
    enableScripting: false,
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: false
  } as Parameters<typeof pdfjs.getDocument>[0] & {
    isEvalSupported: false;
    enableScripting: false;
  };
  return pdfjs.getDocument(documentOptions);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', PDF_PAGE_JPEG_QUALITY);
  });
}

function extractPdfPageText(items: unknown[]) {
  const lines: string[] = [];
  let line = '';
  let lastY: number | null = null;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const chunk = typeof (item as { str?: unknown }).str === 'string'
      ? normalizePdfChunk((item as { str: string }).str)
      : '';
    if (!chunk) continue;

    const transform = Array.isArray((item as { transform?: unknown }).transform)
      ? (item as { transform: unknown[] }).transform
      : null;
    const y = typeof transform?.[5] === 'number' ? transform[5] : null;
    const hasEol = Boolean((item as { hasEOL?: unknown }).hasEOL);

    if (line && y !== null && lastY !== null && Math.abs(y - lastY) > 2.5) {
      flushPdfLine(lines, line);
      line = '';
    }

    if (line && shouldInsertPdfSpace(line, chunk)) {
      line += ' ';
    }
    line += chunk;
    lastY = y ?? lastY;

    if (hasEol) {
      flushPdfLine(lines, line);
      line = '';
      lastY = null;
    }
  }

  flushPdfLine(lines, line);
  return lines.join('\n').trim();
}

export async function readPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfJs();
  const loadingTask = createPdfLoadingTask(pdfjs, buffer);
  const document = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const pageText = extractPdfPageText(textContent.items as unknown[]);
        if (pageText) {
          pages.push(pageText);
        }
      } finally {
        page.cleanup();
      }
    }

    return pages.join('\n\n').trim();
  } finally {
    await loadingTask.destroy();
  }
}

export async function renderPdfPages(
  buffer: ArrayBuffer,
  maxPages = MAX_PDF_VISUAL_PAGES
): Promise<{
  pageCount: number;
  images: Array<{ pageNumber: number; blob: Blob }>;
}> {
  if (typeof document === 'undefined') {
    return { pageCount: 0, images: [] };
  }

  const pdfjs = await loadPdfJs();
  const loadingTask = createPdfLoadingTask(pdfjs, buffer);
  const pdf = await loadingTask.promise;

  try {
    const images: Array<{ pageNumber: number; blob: Blob }> = [];
    const renderCount = Math.min(pdf.numPages, Math.max(0, Math.floor(maxPages)));

    for (let pageNumber = 1; pageNumber <= renderCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, PDF_PAGE_RENDER_MAX_EDGE / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        await page.render({ canvas, viewport, background: '#ffffff' }).promise;
        const blob = await canvasToJpegBlob(canvas);
        canvas.width = 1;
        canvas.height = 1;
        if (blob) {
          images.push({ pageNumber, blob });
        }
      } catch (error) {
        console.warn(`[pdf] page ${pageNumber} image render skipped`, error);
      } finally {
        page.cleanup();
      }
    }

    return { pageCount: pdf.numPages, images };
  } finally {
    await loadingTask.destroy();
  }
}
