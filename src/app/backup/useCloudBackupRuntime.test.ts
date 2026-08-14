import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildPackage: vi.fn(),
  fetchStatus: vi.fn(),
  upload: vi.fn(),
  readConfig: vi.fn(),
  readDate: vi.fn(),
  writeDate: vi.fn()
}));

vi.mock('../shell/completeBackupExport', () => ({
  buildCurrentExportPackage: mocks.buildPackage
}));
vi.mock('./cloudBackupClient', () => ({
  fetchCloudBackupStatus: mocks.fetchStatus,
  uploadCloudBackup: mocks.upload
}));
vi.mock('./cloudBackupSettings', () => ({
  isCloudBackupConfigured: () => true,
  readCloudBackupConfig: mocks.readConfig,
  readLastCloudBackupDailyDate: mocks.readDate,
  writeLastCloudBackupDailyDate: mocks.writeDate
}));

import { runDailyCloudBackupAfterUserMessage } from './dailyCloudBackup';

describe('daily cloud backup user-message boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {});
    mocks.readConfig.mockReturnValue({ enabled: true, endpoint: '/backup', token: 'secret' });
    mocks.readDate.mockReturnValue('2026-08-13');
    mocks.fetchStatus.mockResolvedValue({ backups: [] });
    mocks.buildPackage.mockResolvedValue({ blob: new Blob(['backup']), fileName: 'backup.zip' });
    mocks.upload.mockResolvedValue(undefined);
  });

  it('marks the day only after the complete package upload succeeds', async () => {
    await expect(runDailyCloudBackupAfterUserMessage()).resolves.toEqual({ status: 'uploaded' });
    expect(mocks.buildPackage).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.writeDate).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.writeDate.mock.invocationCallOrder[0]);
  });

  it('does not mark a failed upload, so the next user message can retry', async () => {
    mocks.upload.mockRejectedValueOnce(new Error('offline'));
    await expect(runDailyCloudBackupAfterUserMessage()).rejects.toThrow('offline');
    expect(mocks.writeDate).not.toHaveBeenCalled();

    await expect(runDailyCloudBackupAfterUserMessage()).resolves.toEqual({ status: 'uploaded' });
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.writeDate).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight upload when another user turn settles concurrently', async () => {
    let releaseUpload!: () => void;
    mocks.upload.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseUpload = resolve;
    }));

    const first = runDailyCloudBackupAfterUserMessage();
    const second = runDailyCloudBackupAfterUserMessage();
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    releaseUpload();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'uploaded' },
      { status: 'uploaded' }
    ]);
    expect(mocks.buildPackage).toHaveBeenCalledTimes(1);
    expect(mocks.writeDate).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an existing cloud history before the device restore decision', async () => {
    mocks.readDate.mockReturnValue('');
    mocks.fetchStatus.mockResolvedValue({ backups: [{ id: 'existing-backup' }] });

    await expect(runDailyCloudBackupAfterUserMessage())
      .resolves.toEqual({ status: 'restore_decision_required' });
    expect(mocks.buildPackage).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.writeDate).not.toHaveBeenCalled();
  });
});
