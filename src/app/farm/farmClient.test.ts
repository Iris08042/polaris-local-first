import { describe, expect, it } from 'vitest';
import { farmEndpoint } from './farmClient';
import {
  buildManagedFarmMcpServer,
  mergeManagedFarmMcpServer
} from './managedFarmMcp';

describe('farm client', () => {
  it('derives farm endpoints from both heartbeat roots and inbox URLs', () => {
    expect(farmEndpoint('https://example.com/gateway/api/polaris/heartbeat', 'config'))
      .toBe('https://example.com/gateway/api/polaris/farm/config');
    expect(farmEndpoint('https://example.com/gateway/api/polaris/heartbeat/inbox', 'mcp'))
      .toBe('https://example.com/gateway/api/polaris/farm/mcp');
  });

  it('replaces only the product-managed farm server', () => {
    const managed = buildManagedFarmMcpServer('https://example.com/farm/mcp', 'secret');
    const generic = { ...managed, id: 'generic', handle: 'generic', name: 'Generic' };
    const merged = mergeManagedFarmMcpServer([managed, generic], { ...managed, url: 'https://new.example.com/farm/mcp' });
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe('generic');
    expect(merged[1]?.url).toBe('https://new.example.com/farm/mcp');
  });
});
