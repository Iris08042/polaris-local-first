import { describe, expect, it } from 'vitest';
import { resolveOmbreProxyConfig } from './ombreDashboardClient';

describe('resolveOmbreProxyConfig', () => {
  it('reuses the private cloud gateway and token for the Ombre proxy', () => {
    expect(resolveOmbreProxyConfig({
      enabled: true,
      endpoint: 'https://polaris.example/gateway/api/polaris/backup',
      token: 'private-token'
    })).toEqual({
      configured: true,
      endpoint: 'https://polaris.example/gateway/api/polaris/ombre',
      token: 'private-token'
    });
  });

  it('does not guess when the configured endpoint is not the Polaris gateway', () => {
    expect(resolveOmbreProxyConfig({
      enabled: true,
      endpoint: 'https://dav.example/backups',
      token: 'private-token'
    }).configured).toBe(false);
  });
});
