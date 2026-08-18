import { describe, expect, it } from 'vitest';
import { healthEndpoint } from './healthClient';
import { buildManagedHealthMcpServer, mergeManagedHealthMcpServer } from './managedHealthMcp';

describe('managed health MCP', () => {
  it('derives health routes from the heartbeat gateway', () => {
    const heartbeat = 'https://polaris.example/gateway/api/polaris/heartbeat';
    expect(healthEndpoint(heartbeat, 'status')).toBe('https://polaris.example/gateway/api/polaris/health/status');
    expect(buildManagedHealthMcpServer(heartbeat, 'secret').url)
      .toBe('https://polaris.example/gateway/api/polaris/health/mcp');
  });

  it('replaces or removes only its managed server', () => {
    const existing = [{ id: 'other' }] as never[];
    const managed = buildManagedHealthMcpServer('https://example/api/polaris/heartbeat', 'secret');
    expect(mergeManagedHealthMcpServer(existing, managed).map(server => server.id))
      .toEqual(['other', 'endless-summer-health']);
    expect(mergeManagedHealthMcpServer([...existing, managed], null).map(server => server.id))
      .toEqual(['other']);
  });
});
