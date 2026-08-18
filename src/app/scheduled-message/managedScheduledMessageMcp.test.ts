import { describe, expect, it } from 'vitest';
import {
  buildManagedScheduledMessageMcpServer,
  mergeManagedScheduledMessageMcpServer,
  scheduledMessageMcpEndpoint
} from './managedScheduledMessageMcp';

describe('managed scheduled message MCP', () => {
  it('derives its endpoint from heartbeat roots and inbox URLs', () => {
    expect(scheduledMessageMcpEndpoint('https://example.com/gateway/api/polaris/heartbeat'))
      .toBe('https://example.com/gateway/api/polaris/scheduled-message/mcp');
    expect(scheduledMessageMcpEndpoint('https://example.com/gateway/api/polaris/heartbeat/inbox'))
      .toBe('https://example.com/gateway/api/polaris/scheduled-message/mcp');
  });

  it('replaces only the product-managed scheduled message server', () => {
    const managed = buildManagedScheduledMessageMcpServer(
      'https://example.com/gateway/api/polaris/heartbeat',
      'secret'
    );
    const generic = { ...managed, id: 'generic', handle: 'generic', name: 'Generic' };
    const merged = mergeManagedScheduledMessageMcpServer(
      [managed, generic],
      { ...managed, url: 'https://new.example.com/mcp' }
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe('generic');
    expect(merged[1]?.url).toBe('https://new.example.com/mcp');
  });
});
