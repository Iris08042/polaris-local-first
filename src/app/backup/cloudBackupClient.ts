import type { CloudBackupConfig } from './cloudBackupSettings';

export type CloudBackupMetadata = {
  id: string;
  createdAt: string;
  uploadedAt: string;
  bytes: number;
  sha256: string;
};

export type CloudBackupStatus = {
  backups: CloudBackupMetadata[];
};

function authorization(config: CloudBackupConfig) {
  return { Authorization: `Bearer ${config.token}` };
}

async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requireOk(response: Response, action: string) {
  if (response.ok) return response;
  let detail = '';
  try {
    detail = String((await response.json() as { error?: unknown }).error || '');
  } catch {}
  throw new Error(detail || `${action}失败（HTTP ${response.status}）`);
}

export async function fetchCloudBackupStatus(config: CloudBackupConfig): Promise<CloudBackupStatus> {
  const response = await fetch(`${config.endpoint}/status`, { headers: authorization(config) });
  await requireOk(response, '读取云备份状态');
  return await response.json() as CloudBackupStatus;
}

export async function uploadCloudBackup(
  config: CloudBackupConfig,
  packageBlob: Blob
) {
  const createdAt = new Date().toISOString();
  const sha256 = await sha256Hex(packageBlob);
  const response = await fetch(`${config.endpoint}/backups`, {
    method: 'POST',
    headers: {
      ...authorization(config),
      'Content-Type': 'application/zip',
      'X-Polaris-Backup-Created-At': createdAt
    },
    body: packageBlob
  });
  await requireOk(response, '上传云备份');
  const metadata = (await response.json() as { backup: CloudBackupMetadata }).backup;
  if (metadata.bytes !== packageBlob.size || metadata.sha256 !== sha256) {
    throw new Error('腾讯云收到的备份与本机完整包校验不一致');
  }
  return metadata;
}

export async function downloadCloudBackup(config: CloudBackupConfig, backupId: string) {
  const response = await fetch(`${config.endpoint}/backups/${encodeURIComponent(backupId)}`, {
    headers: authorization(config)
  });
  await requireOk(response, '下载云备份');
  const blob = await response.blob();
  const expectedSha256 = response.headers.get('x-polaris-backup-sha256');
  if (!expectedSha256 || await sha256Hex(blob) !== expectedSha256) {
    throw new Error('下载的云备份完整性校验失败');
  }
  return blob;
}
