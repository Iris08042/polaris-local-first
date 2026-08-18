import { describe, expect, it } from 'vitest';
import { buildMcpHandle } from '../engines/mcpHandle';
import {
  normalizeRuntimeMcpState,
  parseMcpServersJson,
  serializeMcpServersToJson
} from './runtimeStoreMcp';

describe('runtimeStoreMcp', () => {
  it('normalizes malformed timeout and duplicate handles', () => {
    const state = normalizeRuntimeMcpState({
      mcpToolTimeoutSeconds: 0,
      mcpServers: [
        {
          id: 'mcp-1',
          handle: 'demo',
          name: 'Demo',
          description: '',
          transport: 'sse',
          url: ' http://localhost:3000 ',
          headers: [],
          isActive: true
        },
        {
          id: 'mcp-2',
          handle: 'demo',
          name: 'Demo 2',
          description: '',
          transport: 'sse',
          url: 'http://localhost:3001',
          headers: [],
          isActive: false
        }
      ]
    });

    expect(state.mcpToolTimeoutSeconds).toBe(300);
    expect(state.mcpServers[0]?.handle).toBe('demo');
    expect(state.mcpServers[1]?.handle).toBe('demo_2');
    expect(state.mcpServers[0]?.url).toBe('http://localhost:3000');
  });

  it('upgrades the legacy 30 second MCP timeout', () => {
    expect(normalizeRuntimeMcpState({ mcpToolTimeoutSeconds: 30 }).mcpToolTimeoutSeconds).toBe(300);
  });

  it('serializes and parses json editor payloads', () => {
    const json = serializeMcpServersToJson([
      {
        id: 'mcp-1',
        handle: 'kelivo_fetch',
        name: '@kelivo/fetch',
        description: 'Fetch bridge',
        transport: 'streamable-http',
        url: 'http://localhost:3000',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer test' }],
        tools: [{
          name: 'fetch_url',
          description: 'Fetch URL',
          inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
          enabled: false
        }],
        isActive: true
      }
    ]);

    const parsed = parseMcpServersJson(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      handle: 'kelivo_fetch',
      name: '@kelivo/fetch',
      transport: 'streamable-http',
      url: 'http://localhost:3000',
      isActive: true
    });
    expect(parsed[0]?.headers[0]).toMatchObject({
      key: 'Authorization',
      value: 'Bearer test'
    });
    expect(parsed[0]?.tools?.[0]).toMatchObject({
      name: 'fetch_url',
      enabled: false
    });
  });

  it('normalizes malformed MCP tool settings without losing valid switches', () => {
    const state = normalizeRuntimeMcpState({
      mcpServers: [{
        id: 'mcp-tools',
        handle: 'tools',
        name: 'Tools',
        description: '',
        transport: 'streamable-http',
        url: 'https://mcp.example.com',
        headers: [],
        tools: [
          {
            name: '  search_docs  ',
            description: ' Search docs ',
            inputSchema: { type: 'object' },
            enabled: false
          },
          {
            name: '',
            description: 'ignored',
            inputSchema: { type: 'object' },
            enabled: true
          }
        ],
        isActive: true
      }]
    });

    expect(state.mcpServers[0]?.tools).toEqual([{
      name: 'search_docs',
      description: 'Search docs',
      inputSchema: { type: 'object' },
      enabled: false
    }]);
  });
});
