import { buildCurrentExportPackage } from '../shell/completeBackupExport';
import { fetchCloudBackupStatus, uploadCloudBackup } from './cloudBackupClient';
import {
  isCloudBackupConfigured,
  readCloudBackupConfig,
  readLastCloudBackupDailyDate,
  writeLastCloudBackupDailyDate
} from './cloudBackupSettings';

let runningDailyBackup: Promise<DailyCloudBackupResult> | null = null;

function localDateLabel(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .join('-');
}

export type DailyCloudBackupResult =
  | { status: 'uploaded' }
  | { status: 'already_completed' }
  | { status: 'not_configured' }
  | { status: 'restore_decision_required' };

async function runDailyCloudBackup(): Promise<DailyCloudBackupResult> {
  if (typeof window === 'undefined') return { status: 'not_configured' };
  const today = localDateLabel();
  if (readLastCloudBackupDailyDate() === today) return { status: 'already_completed' };
  const config = readCloudBackupConfig();
  if (!config.enabled || !isCloudBackupConfigured(config)) return { status: 'not_configured' };

  const status = await fetchCloudBackupStatus(config);
  if (status.backups.length > 0 && !readLastCloudBackupDailyDate()) {
    return { status: 'restore_decision_required' };
  }
  const { blob } = await buildCurrentExportPackage();
  await uploadCloudBackup(config, blob);
  writeLastCloudBackupDailyDate(today);
  return { status: 'uploaded' };
}

export async function runDailyCloudBackupAfterUserMessage(): Promise<DailyCloudBackupResult> {
  if (runningDailyBackup) return await runningDailyBackup;
  runningDailyBackup = runDailyCloudBackup();
  try {
    return await runningDailyBackup;
  } finally {
    runningDailyBackup = null;
  }
}
