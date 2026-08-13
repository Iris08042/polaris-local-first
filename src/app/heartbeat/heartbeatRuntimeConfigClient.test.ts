import { describe, expect, it } from 'vitest';
import { heartbeatRuntimeConfigEndpoint } from './heartbeatRuntimeConfigClient';

describe('heartbeat runtime config endpoints', () => {
  it('derives model and prompt endpoints from the stored heartbeat root', () => {
    const root = 'https://polaris.example.com/gateway/api/polaris/heartbeat';
    expect(heartbeatRuntimeConfigEndpoint(root, 'model')).toBe(`${root}/model`);
    expect(heartbeatRuntimeConfigEndpoint(root, 'prompt')).toBe(`${root}/prompt`);
  });

  it('also accepts the direct inbox endpoint', () => {
    const inbox = 'https://polaris.example.com/gateway/api/polaris/heartbeat/inbox';
    expect(heartbeatRuntimeConfigEndpoint(inbox, 'model')).toBe('https://polaris.example.com/gateway/api/polaris/heartbeat/model');
  });
});
