import { describe, expect, it } from 'vitest';
import { heartbeatPolicyEndpoint } from './heartbeatPolicyClient';

describe('heartbeat policy endpoint', () => {
  it('preserves the gateway prefix when derived from the inbox URL', () => {
    expect(heartbeatPolicyEndpoint(
      'https://polaris.example.com/gateway/api/polaris/heartbeat/inbox'
    )).toBe('https://polaris.example.com/gateway/api/polaris/heartbeat/policy');
  });

  it('also accepts the stored heartbeat base endpoint', () => {
    expect(heartbeatPolicyEndpoint(
      'https://polaris.example.com/gateway/api/polaris/heartbeat'
    )).toBe('https://polaris.example.com/gateway/api/polaris/heartbeat/policy');
  });
});
