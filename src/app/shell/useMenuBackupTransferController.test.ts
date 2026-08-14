import { describe, expect, it } from 'vitest';
import {
  formatMenuLocalBackupError,
  resolveMenuLocalBackupDetails
} from './useMenuBackupTransferController';

describe('menu backup transfer model', () => {
  it('describes native backup availability', () => {
    expect(resolveMenuLocalBackupDetails('native')).toEqual({
      localBackupAvailable: true,
      localExportDetail: '保存到系统文件',
      localImportDetail: '从系统文件选取'
    });
  });

  it('describes browser backup availability', () => {
    expect(resolveMenuLocalBackupDetails('browser')).toEqual({
      localBackupAvailable: true,
      localExportDetail: '下载到当前设备',
      localImportDetail: '从当前设备选一个 zip'
    });
  });

  it('describes unavailable local backup support', () => {
    expect(resolveMenuLocalBackupDetails('unavailable')).toEqual({
      localBackupAvailable: false,
      localExportDetail: '当前 App 版暂未接通',
      localImportDetail: '当前 App 版暂未接通'
    });
  });

  it('keeps import and export native-file errors action-specific', () => {
    expect(formatMenuLocalBackupError(new Error('SystemFile not implemented on ios'), '导出'))
      .toBe('当前 App 版暂时无法导出本地备份包，请改用云端备份。');
    expect(formatMenuLocalBackupError(new Error('SystemFile not implemented on ios'), '导入'))
      .toBe('当前 App 版暂时无法导入本地备份包，请改用云端备份。');
  });

  it('keeps iOS read failures explicit during import', () => {
    expect(formatMenuLocalBackupError(new Error('I/O read operation failed'), '导入'))
      .toBe('iOS 没能读到刚选中的备份文件。请先在“文件”App 或 iCloud 里确认备份包已经下载完成，再重新选择一次；这一步还没有开始解析备份内容。');
  });
});
