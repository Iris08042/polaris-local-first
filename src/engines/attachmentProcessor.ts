import { createStoredAttachment } from '../infrastructure/assetStore';
import { isDocxFile, isPdfFile, readDocumentAttachment } from './attachmentDocumentReaders';
import { prepareStoredImageBlob } from './imageAssetProcessing';
import { renderPdfPages } from './pdfTextReader';
import { isCsvFile, isXlsxFile, readSpreadsheetAttachment } from './attachmentSpreadsheetReaders';
import type { ChatAttachment } from '../types/domain';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_SPREADSHEET_BYTES = 8 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'html',
  'xml',
  'yml',
  'yaml',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'sql'
]);
const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip'
]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error(`读取 ${file.name} 失败`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsArrayBuffer(file);
  });
}

function getExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json' || file.type === 'application/xml') return true;
  return TEXT_EXTENSIONS.has(getExtension(file.name));
}

function isTextLikeEntry(name: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(name));
}

function isZipFile(file: File): boolean {
  return ZIP_MIME_TYPES.has(file.type) || getExtension(file.name) === 'zip';
}

async function readStructuredDocumentAsAttachment(file: File): Promise<ChatAttachment | null> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`${file.name} 超过 8MB，先拆小一点再发更稳。`);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return await readDocumentAttachment({ file, buffer });
}

async function createRawFileAttachment(file: File, mimeType: string): Promise<ChatAttachment> {
  return await createStoredAttachment({
    kind: 'file',
    name: file.name,
    mimeType: file.type || mimeType,
    blob: file
  });
}

async function readSpreadsheetAsAttachment(file: File): Promise<ChatAttachment | null> {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new Error(`${file.name} 超过 8MB，先拆小一点再发更稳。`);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return await readSpreadsheetAttachment({ file, buffer });
}

function formatAttachmentStorageError(file: File, error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) {
    return `${file.name} 保存失败了，像是本地存储这一步没接住。`;
  }
  return `${file.name} 保存失败：${message}`;
}

async function readPdfAsAttachments(file: File): Promise<{
  attachments: ChatAttachment[];
  warnings: string[];
}> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`${file.name} 超过 8MB，先拆小一点再发更稳。`);
  }

  const buffer = await readFileAsArrayBuffer(file);
  let documentAttachment: ChatAttachment | null = null;
  try {
    documentAttachment = await readDocumentAttachment({ file, buffer: buffer.slice(0) });
  } catch (error) {
    console.warn(`[pdf] text extraction skipped for ${file.name}`, error);
  }

  let renderedPages: Awaited<ReturnType<typeof renderPdfPages>> | null = null;
  try {
    renderedPages = await renderPdfPages(buffer.slice(0));
  } catch (error) {
    console.warn(`[pdf] visual page rendering skipped for ${file.name}`, error);
  }

  const attachments = [
    documentAttachment ?? await createRawFileAttachment(file, 'application/pdf')
  ];
  const warnings: string[] = [];
  let storedVisualPages = 0;

  for (const page of renderedPages?.images ?? []) {
    const pageName = `${file.name} · 第${page.pageNumber}页.jpg`;
    try {
      attachments.push(await createStoredAttachment({
        kind: 'image',
        name: pageName,
        mimeType: 'image/jpeg',
        blob: page.blob
      }));
      storedVisualPages += 1;
    } catch (error) {
      warnings.push(formatAttachmentStorageError(
        new File([page.blob], pageName, { type: 'image/jpeg' }),
        error
      ));
    }
  }

  if (renderedPages && storedVisualPages > 0 && storedVisualPages < renderedPages.pageCount) {
    warnings.push(`${file.name} 共 ${renderedPages.pageCount} 页，已把其中 ${storedVisualPages} 页转成图片；要看其余页面请拆分 PDF 后再发。`);
  } else if (storedVisualPages === 0) {
    warnings.push(documentAttachment
      ? `${file.name} 已提取文字，但页面图片没有转换成功；模型暂时看不到其中插图。`
      : `${file.name} 已附上原始 PDF，但未能提取文字或转换页面图片；模型这轮只能看到文件名。`);
  }

  return { attachments, warnings };
}

export async function readFilesAsAttachments(files: FileList | File[]): Promise<{
  attachments: ChatAttachment[];
  rejected: string[];
  warnings: string[];
}> {
  const attachments: ChatAttachment[] = [];
  const rejected: string[] = [];
  const warnings: string[] = [];

  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      try {
        const processedImage = await prepareStoredImageBlob({
          blob: file,
          mimeType: file.type || 'image/*'
        });
        attachments.push(
          await createStoredAttachment({
            kind: 'image',
            name: file.name,
            mimeType: processedImage.mimeType,
            blob: processedImage.blob,
            previewBlob: processedImage.previewBlob
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    if (isPdfFile(file)) {
      try {
        const result = await readPdfAsAttachments(file);
        attachments.push(...result.attachments);
        warnings.push(...result.warnings);
      } catch (error) {
        try {
          attachments.push(await createRawFileAttachment(file, 'application/pdf'));
          warnings.push(`${file.name} 已附上原始 PDF，但页面解析没有成功；模型这轮只能看到文件名。`);
        } catch (storageError) {
          rejected.push(formatAttachmentStorageError(file, storageError));
        }
      }
      continue;
    }

    if (isDocxFile(file)) {
      try {
        const attachment = await readStructuredDocumentAsAttachment(file);
        if (!attachment) {
          rejected.push(`${file.name} 里没有提取到可读文字，可能是扫描件或受保护文档。`);
          continue;
        }
        attachments.push(attachment);
      } catch (error) {
        rejected.push(error instanceof Error ? error.message : `${file.name} 读取失败。`);
      }
      continue;
    }

    if (isCsvFile(file) || isXlsxFile(file)) {
      try {
        const attachment = await readSpreadsheetAsAttachment(file);
        if (!attachment) {
          rejected.push(`${file.name} 里没有提取到可读表格内容。`);
          continue;
        }
        attachments.push(attachment);
      } catch (error) {
        rejected.push(error instanceof Error ? error.message : `${file.name} 读取失败。`);
      }
      continue;
    }

    if (isZipFile(file)) {
      try {
        attachments.push(
          await createStoredAttachment({
            kind: 'file',
            name: file.name,
            mimeType: file.type || 'application/zip',
            blob: file
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    if (isTextLikeFile(file)) {
      const textContent = await readFileAsText(file);
      try {
        attachments.push(
          await createStoredAttachment({
            kind: 'file',
            name: file.name,
            mimeType: file.type || 'text/plain',
            blob: file,
            textContent
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    rejected.push(`${file.name} 不支持这种文件。可以发送图片、zip、pdf、docx、xlsx、csv、和文本/代码文件。`);
  }

  return { attachments, rejected, warnings };
}
