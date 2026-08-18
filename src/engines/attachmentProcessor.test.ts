import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { createStoredAttachmentMock, readDocumentAttachmentMock, renderPdfPagesMock } = vi.hoisted(() => ({
  createStoredAttachmentMock: vi.fn(async (params: {
    kind: 'image' | 'file';
    name: string;
    mimeType: string;
    blob: Blob;
    textContent?: string;
  }) => ({
    id: 'attachment-1',
    assetId: 'asset-1',
    kind: params.kind,
    name: params.name,
    mimeType: params.mimeType,
    size: params.blob.size,
    textContent: params.textContent
  })),
  readDocumentAttachmentMock: vi.fn(),
  renderPdfPagesMock: vi.fn()
}));

vi.mock('../infrastructure/assetStore', () => ({
  createStoredAttachment: createStoredAttachmentMock
}));

vi.mock('./attachmentDocumentReaders', () => ({
  isDocxFile: (file: File) => file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || file.name.toLowerCase().endsWith('.docx'),
  isPdfFile: (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
  readDocumentAttachment: readDocumentAttachmentMock
}));

vi.mock('./pdfTextReader', () => ({
  renderPdfPages: renderPdfPagesMock
}));

import { readFilesAsAttachments } from './attachmentProcessor';

class FileReaderMock {
  result: string | ArrayBuffer | null = null;
  error: Error | null = null;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onload?.();
      })
      .catch((error) => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.onerror?.();
      });
  }

  readAsText(blob: Blob) {
    void blob.text()
      .then((text) => {
        this.result = text;
        this.onload?.();
      })
      .catch((error) => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.onerror?.();
      });
  }
}

describe('attachmentProcessor', () => {
  beforeAll(() => {
    vi.stubGlobal('FileReader', FileReaderMock);
  });

  beforeEach(() => {
    createStoredAttachmentMock.mockClear();
    readDocumentAttachmentMock.mockReset();
    renderPdfPagesMock.mockReset();
    renderPdfPagesMock.mockResolvedValue({ pageCount: 0, images: [] });
  });

  it('stores zip uploads as file attachments without inline text', async () => {
    const file = new File(['zip-bytes'], 'bundle.zip', { type: 'application/zip' });
    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.attachments).toEqual([
      {
        id: 'attachment-1',
        assetId: 'asset-1',
        kind: 'file',
        name: 'bundle.zip',
        mimeType: 'application/zip',
        size: file.size,
        textContent: undefined
      }
    ]);
    expect(createStoredAttachmentMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'file',
      name: 'bundle.zip',
      mimeType: 'application/zip',
      blob: file
    }));
  });

  it('stores images without duplicating a preview blob', async () => {
    const file = new File(['img-bytes'], 'photo.png', { type: 'image/png' });
    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.attachments[0]).toMatchObject({
      kind: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      size: file.size
    });
    expect(createStoredAttachmentMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      blob: file
    }));
    expect(createStoredAttachmentMock).not.toHaveBeenCalledWith(expect.objectContaining({
      previewBlob: file
    }));
  });

  it('stores large image uploads instead of rejecting them before asset processing', async () => {
    const file = new File([new Uint8Array((5 * 1024 * 1024) + 1)], 'large-photo.png', { type: 'image/png' });
    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.attachments[0]).toMatchObject({
      kind: 'image',
      name: 'large-photo.png',
      mimeType: 'image/png',
      size: file.size
    });
    expect(createStoredAttachmentMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      name: 'large-photo.png',
      mimeType: 'image/png',
      blob: file
    }));
  });

  it('turns image storage failures into per-file rejections instead of throwing', async () => {
    createStoredAttachmentMock.mockRejectedValueOnce(new Error('Quota exceeded'));
    const file = new File(['img-bytes'], 'heavy.png', { type: 'image/png' });

    const result = await readFilesAsAttachments([file]);

    expect(result.attachments).toEqual([]);
    expect(result.rejected).toEqual(['heavy.png 保存失败：Quota exceeded']);
  });

  it('keeps PDF uploads attached when pdfjs fails on this runtime', async () => {
    readDocumentAttachmentMock.mockRejectedValueOnce(new TypeError("undefined is not a function (near '...i of t...')"));
    const file = new File(['pdf-bytes'], 'paper.pdf', { type: 'application/pdf' });

    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.warnings).toEqual([
      'paper.pdf 已附上原始 PDF，但未能提取文字或转换页面图片；模型这轮只能看到文件名。'
    ]);
    expect(result.attachments[0]).toMatchObject({
      kind: 'file',
      name: 'paper.pdf',
      mimeType: 'application/pdf',
      size: file.size,
      textContent: undefined
    });
    expect(createStoredAttachmentMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'file',
      name: 'paper.pdf',
      mimeType: 'application/pdf',
      blob: file
    }));
  });

  it('keeps unreadable PDF uploads attached as raw files', async () => {
    readDocumentAttachmentMock.mockResolvedValueOnce(null);
    const file = new File(['pdf-bytes'], 'scan.pdf', { type: 'application/pdf' });

    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.warnings).toEqual([
      'scan.pdf 已附上原始 PDF，但未能提取文字或转换页面图片；模型这轮只能看到文件名。'
    ]);
    expect(result.attachments[0]).toMatchObject({
      kind: 'file',
      name: 'scan.pdf',
      mimeType: 'application/pdf'
    });
  });

  it('turns PDF pages into image attachments so vision models can inspect diagrams', async () => {
    const file = new File(['pdf-bytes'], 'illustrated.pdf', { type: 'application/pdf' });
    readDocumentAttachmentMock.mockResolvedValueOnce({
      id: 'pdf-attachment',
      assetId: 'pdf-asset',
      kind: 'file',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      textContent: '已提取的正文'
    });
    renderPdfPagesMock.mockResolvedValueOnce({
      pageCount: 2,
      images: [
        { pageNumber: 1, blob: new Blob(['page-1'], { type: 'image/jpeg' }) },
        { pageNumber: 2, blob: new Blob(['page-2'], { type: 'image/jpeg' }) }
      ]
    });

    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.attachments).toHaveLength(3);
    expect(result.attachments[0]).toMatchObject({ kind: 'file', name: 'illustrated.pdf' });
    expect(createStoredAttachmentMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: 'image',
      name: 'illustrated.pdf · 第1页.jpg',
      mimeType: 'image/jpeg'
    }));
    expect(createStoredAttachmentMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'image',
      name: 'illustrated.pdf · 第2页.jpg',
      mimeType: 'image/jpeg'
    }));
  });

  it('accepts large text attachments instead of rejecting them at 300KB', async () => {
    const content = '聊天记录\n'.repeat(60_000);
    const file = new File([content], '存档_聊天记录_时间顺序_20260526.txt', { type: 'text/plain' });

    expect(file.size).toBeGreaterThan(300 * 1024);

    const result = await readFilesAsAttachments([file]);

    expect(result.rejected).toEqual([]);
    expect(result.attachments[0]).toMatchObject({
      kind: 'file',
      name: '存档_聊天记录_时间顺序_20260526.txt',
      mimeType: 'text/plain',
      size: file.size,
      textContent: content
    });
  });
});
