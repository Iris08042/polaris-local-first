import { useI18n } from '../../../i18n';
import { HelpHint } from '../../HelpHint';
import { Icon } from '../../Icon';
import { MenuSheetItem } from './MenuSheetItem';
import type { CloudBackupConfig } from '../../../app/backup/cloudBackupSettings';
import type { CloudBackupStatus } from '../../../app/backup/cloudBackupClient';

type MenuBackupPageProps = {
  busy: boolean;
  localBackupAvailable: boolean;
  exportingData: boolean;
  importingData: boolean;
  cloudBackupConfig: CloudBackupConfig;
  cloudBackupConfigured: boolean;
  cloudBackupStatus: CloudBackupStatus | null;
  cloudBackupBusy: boolean;
  localExportDetail: string;
  localImportDetail: string;
  localExportProgress: number | null;
  localImportProgress: number | null;
  onBack: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onSetCloudBackupConfig: (patch: Partial<CloudBackupConfig>) => void;
  onRefreshCloudBackupStatus: () => void;
  onUploadToCloud: () => void;
  onRestoreFromCloud: (backupId: string) => void;
};

export function MenuBackupPage({
  busy,
  localBackupAvailable,
  exportingData,
  importingData,
  cloudBackupConfig,
  cloudBackupConfigured,
  cloudBackupStatus,
  cloudBackupBusy,
  localExportDetail,
  localImportDetail,
  localExportProgress,
  localImportProgress,
  onBack,
  onExportData,
  onImportData,
  onSetCloudBackupConfig,
  onRefreshCloudBackupStatus,
  onUploadToCloud,
  onRestoreFromCloud
}: MenuBackupPageProps) {
  const { t } = useI18n();

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.dataSection')}</small>
          <h2>
            {t('settings.backup.title')}
            <HelpHint
              className="help-hint--inline-title"
              label={t('settings.backup.title')}
              text={t('settings.backup.pageHelp')}
            />
          </h2>
          <p>{t('settings.backup.pageDetail')}</p>
        </div>
      </div>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.backup.localSection')}</span>
          <p className="menu-section-note">
            {localBackupAvailable
              ? t('settings.backup.localAvailableNote')
              : t('settings.backup.localUnavailableNote')}
          </p>
        </div>
        <MenuSheetItem
          icon="copy"
          title={exportingData ? t('settings.backup.exporting') : t('settings.backup.exportCurrent')}
          detail={localExportDetail}
          progress={localExportProgress}
          onClick={onExportData}
          disabled={busy || !localBackupAvailable}
        />
        <MenuSheetItem
          icon="folder"
          title={importingData ? t('settings.backup.importing') : t('settings.backup.importFromPackage')}
          detail={localImportDetail || t('settings.backup.importDetailFallback')}
          progress={localImportProgress}
          onClick={onImportData}
          disabled={busy || !localBackupAvailable}
        />
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">无尽夏完整云备份</span>
          <p className="menu-section-note">
            每天第一次打开无尽夏时上传一份完整备份；当天不再重复上传。
          </p>
        </div>
        <div className="menu-webdav-section">
          <div className="settings-form">
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                checked={cloudBackupConfig.enabled}
                onChange={(event) => onSetCloudBackupConfig({ enabled: event.target.checked })}
              />
              每日首次打开时自动备份
            </label>
            <label>云备份地址</label>
            <input
              value={cloudBackupConfig.endpoint}
              onChange={(event) => onSetCloudBackupConfig({ endpoint: event.target.value })}
              placeholder="https://polaris.yichen888.top/gateway/api/polaris/backup"
            />
            <label>备份密钥</label>
            <input
              type="password"
              value={cloudBackupConfig.token}
              onChange={(event) => onSetCloudBackupConfig({ token: event.target.value })}
              placeholder="只保存在当前设备和完整备份中"
            />
          </div>
          <div className="provider-inline-actions menu-webdav-actions">
            <button type="button" className="btn-secondary" onClick={onUploadToCloud} disabled={busy || !cloudBackupConfigured}>
              立即完整备份
            </button>
            <button type="button" className="btn-secondary" onClick={onRefreshCloudBackupStatus} disabled={busy || !cloudBackupConfigured}>
              {cloudBackupBusy ? '读取中…' : '查看云端备份'}
            </button>
          </div>
          <div className="settings-note">
            {cloudBackupStatus?.backups[0]
              ? `最新：${new Date(cloudBackupStatus.backups[0].uploadedAt).toLocaleString()} · ${(cloudBackupStatus.backups[0].bytes / 1024 / 1024).toFixed(1)} MB`
              : cloudBackupConfigured
                ? '密钥已填写。首次点击“立即完整备份”后，云端才会有可恢复数据。'
                : '先在腾讯云配置独立备份密钥，再把相同密钥填在这里。'}
          </div>
          {cloudBackupStatus?.backups.length ? (
            <div className="settings-form">
              <label>最近三次完整备份</label>
              {cloudBackupStatus.backups.map((backup, index) => (
                <button
                  type="button"
                  className="btn-secondary"
                  key={backup.id}
                  onClick={() => onRestoreFromCloud(backup.id)}
                  disabled={busy}
                >
                  {index === 0 ? '恢复最新' : '恢复'} · {new Date(backup.uploadedAt).toLocaleString()}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

    </div>
  );
}
