import { useEffect, useState } from 'react';
import { buildCurrentExportPackage } from '../shell/completeBackupExport';
import { fetchCloudBackupStatus, uploadCloudBackup } from './cloudBackupClient';
import {
  CLOUD_BACKUP_CONFIG_CHANGED_EVENT,
  isCloudBackupConfigured,
  readCloudBackupConfig,
  readLastCloudBackupDailyDate,
  writeLastCloudBackupDailyDate
} from './cloudBackupSettings';

const STARTUP_CHECK_DELAY_MS = 1_500;

function localDateLabel(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .join('-');
}

export function useCloudBackupRuntime({ enabled }: { enabled: boolean }) {
  const [configRevision, setConfigRevision] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleConfigChanged = () => setConfigRevision((value) => value + 1);
    window.addEventListener(CLOUD_BACKUP_CONFIG_CHANGED_EVENT, handleConfigChanged);
    return () => window.removeEventListener(CLOUD_BACKUP_CONFIG_CHANGED_EVENT, handleConfigChanged);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const config = readCloudBackupConfig();
    if (!config.enabled || !isCloudBackupConfigured(config)) return;

    let timeoutId: number | null = null;
    let uploading = false;
    let disposed = false;

    const schedule = (delay: number) => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void runDailyBackup();
      }, delay);
    };

    const runDailyBackup = async () => {
      if (disposed || uploading || document.visibilityState === 'hidden') return;
      const today = localDateLabel();
      if (readLastCloudBackupDailyDate() === today) return;
      uploading = true;
      try {
        const currentConfig = readCloudBackupConfig();
        const status = await fetchCloudBackupStatus(currentConfig);
        if (status.backups.length > 0 && !readLastCloudBackupDailyDate()) {
          // This is a newly connected browser. Do not overwrite an existing cloud backup
          // before the user has chosen restore or manual backup on this device.
          return;
        }
        const { blob } = await buildCurrentExportPackage();
        await uploadCloudBackup(currentConfig, blob);
        writeLastCloudBackupDailyDate(today);
      } catch (error) {
        console.warn('[cloud-backup] daily upload failed', error);
      } finally {
        uploading = false;
      }
    };

    const handleVisibilityChanged = () => {
      if (document.visibilityState === 'visible') schedule(STARTUP_CHECK_DELAY_MS);
    };
    document.addEventListener('visibilitychange', handleVisibilityChanged);
    schedule(STARTUP_CHECK_DELAY_MS);

    return () => {
      disposed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChanged);
    };
  }, [enabled, configRevision]);
}
