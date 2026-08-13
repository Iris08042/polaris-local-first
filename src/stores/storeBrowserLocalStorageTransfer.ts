const LOCAL_STORAGE_PREFIX = 'polaris';

export type BackupLocalStorageEntry = {
  key: string;
  value: string;
};

export function readBackupLocalStorage(): BackupLocalStorageEntry[] {
  if (typeof window === 'undefined') return [];
  const entries: BackupLocalStorageEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
      const value = window.localStorage.getItem(key);
      if (value !== null) entries.push({ key, value });
    }
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export function validateBackupLocalStorage(value: unknown): BackupLocalStorageEntry[] {
  if (!Array.isArray(value)) throw new Error('备份里的浏览器设置格式不正确');
  const keys = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('备份里的浏览器设置格式不正确');
    }
    const { key, value: entryValue } = entry as Partial<BackupLocalStorageEntry>;
    if (typeof key !== 'string' || !key.startsWith(LOCAL_STORAGE_PREFIX) || typeof entryValue !== 'string') {
      throw new Error('备份里的浏览器设置包含无效项目');
    }
    if (keys.has(key)) throw new Error(`备份里的浏览器设置包含重复项目：${key}`);
    keys.add(key);
    return { key, value: entryValue };
  });
}

export function replaceBackupLocalStorage(entries: BackupLocalStorageEntry[]) {
  if (typeof window === 'undefined') return [];
  const previous = readBackupLocalStorage();
  try {
    for (const entry of previous) window.localStorage.removeItem(entry.key);
    for (const entry of entries) window.localStorage.setItem(entry.key, entry.value);
  } catch (error) {
    try {
      for (const entry of readBackupLocalStorage()) window.localStorage.removeItem(entry.key);
      for (const entry of previous) window.localStorage.setItem(entry.key, entry.value);
    } catch (rollbackError) {
      throw new Error(`localStorage 写入失败且旧值恢复失败：${String(rollbackError)}；原始错误：${String(error)}`);
    }
    throw error;
  }
  return previous;
}

export function restoreBackupLocalStorage(entries: BackupLocalStorageEntry[]) {
  if (typeof window === 'undefined') return;
  for (const entry of readBackupLocalStorage()) window.localStorage.removeItem(entry.key);
  for (const entry of entries) window.localStorage.setItem(entry.key, entry.value);
}
