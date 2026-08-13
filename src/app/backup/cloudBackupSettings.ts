export const CLOUD_BACKUP_CONFIG_CHANGED_EVENT = 'polaris:cloud-backup-config-changed';

const CLOUD_BACKUP_STORAGE_KEY = 'polaris-cloud-backup-v1';
const CLOUD_BACKUP_LAST_DAILY_DATE_KEY = 'polaris-cloud-backup-last-daily-date-v1';

export type CloudBackupConfig = {
  enabled: boolean;
  endpoint: string;
  token: string;
};

export function defaultCloudBackupEndpoint() {
  return typeof window === 'undefined'
    ? ''
    : `${window.location.origin}/gateway/api/polaris/backup`;
}

export function normalizeCloudBackupConfig(value: Partial<CloudBackupConfig>): CloudBackupConfig {
  return {
    enabled: value.enabled === true,
    endpoint: (typeof value.endpoint === 'string' ? value.endpoint : defaultCloudBackupEndpoint())
      .trim()
      .replace(/\/+$/, ''),
    token: typeof value.token === 'string' ? value.token.trim() : ''
  };
}

export function readCloudBackupConfig(): CloudBackupConfig {
  const fallback = normalizeCloudBackupConfig({ enabled: false });
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(CLOUD_BACKUP_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    return normalizeCloudBackupConfig(JSON.parse(raw) as Partial<CloudBackupConfig>);
  } catch {
    return fallback;
  }
}

export function writeCloudBackupConfig(value: CloudBackupConfig) {
  const normalized = normalizeCloudBackupConfig(value);
  window.localStorage.setItem(CLOUD_BACKUP_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(CLOUD_BACKUP_CONFIG_CHANGED_EVENT));
  return normalized;
}

export function isCloudBackupConfigured(config: CloudBackupConfig) {
  return Boolean(config.endpoint && config.token);
}

export function readLastCloudBackupDailyDate() {
  return typeof window === 'undefined'
    ? ''
    : window.localStorage.getItem(CLOUD_BACKUP_LAST_DAILY_DATE_KEY) || '';
}

export function writeLastCloudBackupDailyDate(value: string) {
  window.localStorage.setItem(CLOUD_BACKUP_LAST_DAILY_DATE_KEY, value);
}

export function markCloudBackupCompletedToday(now = new Date()) {
  writeLastCloudBackupDailyDate([
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-'));
}
