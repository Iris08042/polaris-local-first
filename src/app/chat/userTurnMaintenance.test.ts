import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateSummary: vi.fn(),
  backup: vi.fn()
}));

vi.mock('./rollingSummary', () => ({
  updateRollingSummaryForConversation: mocks.updateSummary
}));

vi.mock('../backup/dailyCloudBackup', () => ({
  runDailyCloudBackupAfterUserMessage: mocks.backup
}));

import { runUserTurnMaintenance } from './userTurnMaintenance';

describe('user-turn maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSummary.mockResolvedValue({ status: 'up_to_date', messageCount: 0 });
    mocks.backup.mockResolvedValue({ status: 'uploaded' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs summary before the daily backup after a completed reply', async () => {
    await runUserTurnMaintenance('conversation-1', { status: 'completed' });

    expect(mocks.updateSummary).toHaveBeenCalledWith('conversation-1');
    expect(mocks.backup).toHaveBeenCalledTimes(1);
    expect(mocks.updateSummary.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.backup.mock.invocationCallOrder[0]);
  });

  it('still backs up a durable user message when the reply failed or was aborted', async () => {
    await runUserTurnMaintenance('conversation-1', { status: 'failed' });
    await runUserTurnMaintenance('conversation-1', { status: 'aborted' });

    expect(mocks.updateSummary).not.toHaveBeenCalled();
    expect(mocks.backup).toHaveBeenCalledTimes(2);
  });

  it('does not let a summary failure block the backup', async () => {
    mocks.updateSummary.mockRejectedValueOnce(new Error('summary offline'));

    await expect(runUserTurnMaintenance('conversation-1', { status: 'completed' })).resolves.toBeUndefined();
    expect(mocks.backup).toHaveBeenCalledTimes(1);
  });
});
