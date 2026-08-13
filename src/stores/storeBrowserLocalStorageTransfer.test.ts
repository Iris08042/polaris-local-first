import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readBackupLocalStorage,
  replaceBackupLocalStorage,
  validateBackupLocalStorage
} from './storeBrowserLocalStorageTransfer';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('complete backup browser settings', () => {
  it('captures every Polaris-owned setting and ignores unrelated site data', () => {
    const localStorage = createStorage({
      'polaris-heartbeat-inbox-v1': '{"enabled":true}',
      'polaris-cloud-backup-v1': '{"enabled":true}',
      'outside-key': 'keep local'
    });
    vi.stubGlobal('window', { localStorage });

    expect(readBackupLocalStorage()).toEqual([
      { key: 'polaris-cloud-backup-v1', value: '{"enabled":true}' },
      { key: 'polaris-heartbeat-inbox-v1', value: '{"enabled":true}' }
    ]);
  });

  it('replaces all Polaris-owned settings while retaining unrelated site data', () => {
    const localStorage = createStorage({
      'polaris-old-module-v1': 'old',
      'outside-key': 'keep local'
    });
    vi.stubGlobal('window', { localStorage });

    replaceBackupLocalStorage(validateBackupLocalStorage([
      { key: 'polaris-heartbeat-inbox-v1', value: 'restored' }
    ]));

    expect(localStorage.getItem('polaris-old-module-v1')).toBeNull();
    expect(localStorage.getItem('polaris-heartbeat-inbox-v1')).toBe('restored');
    expect(localStorage.getItem('outside-key')).toBe('keep local');
  });
});
