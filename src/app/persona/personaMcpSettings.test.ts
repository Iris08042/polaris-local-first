import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { McpServerConfig } from '../../types/domain';
import { resolvePersonaMcpServers } from './personaMcpSettings';

function createServer(id: string): McpServerConfig {
  return {
    id,
    handle: id,
    name: id,
    description: '',
    transport: 'streamable-http',
    url: `https://${id}.example.com/mcp`,
    headers: [],
    tools: [],
    isActive: true
  };
}

describe('resolvePersonaMcpServers', () => {
  const servers = [createServer('mcp-a'), createServer('mcp-b')];

  it('returns every MCP server when the collaborator follows global settings', () => {
    const persona = createPersonaTemplate({
      id: 'persona-a',
      name: 'A',
      description: '',
      mcp: {
        inheritGlobal: true,
        serverIds: ['mcp-b']
      }
    });

    expect(resolvePersonaMcpServers({ persona, mcpServers: servers })).toEqual(servers);
  });

  it('returns only selected MCP servers when the collaborator has a personal set', () => {
    const persona = createPersonaTemplate({
      id: 'persona-b',
      name: 'B',
      description: '',
      mcp: {
        inheritGlobal: false,
        serverIds: ['mcp-b', 'missing']
      }
    });

    expect(resolvePersonaMcpServers({ persona, mcpServers: servers })).toEqual([servers[1]]);
  });

  it('returns no MCP servers for an empty personal set', () => {
    const persona = createPersonaTemplate({
      id: 'persona-c',
      name: 'C',
      description: '',
      mcp: {
        inheritGlobal: false,
        serverIds: []
      }
    });

    expect(resolvePersonaMcpServers({ persona, mcpServers: servers })).toEqual([]);
  });

  it('keeps the product-managed farm available to a collaborator with a personal set', () => {
    const persona = createPersonaTemplate({
      id: 'persona-farm',
      name: 'Farm',
      description: '',
      mcp: { inheritGlobal: false, serverIds: [] }
    });
    const farm = createServer('endless-summer-farm');

    expect(resolvePersonaMcpServers({ persona, mcpServers: [...servers, farm] })).toEqual([farm]);
  });
});
