import type { McpServerConfig } from '../../types/domain';

export const MANAGED_FARM_MCP_SERVER_ID = 'endless-summer-farm';

export function isManagedFarmMcpServer(server: Pick<McpServerConfig, 'id'>) {
  return server.id === MANAGED_FARM_MCP_SERVER_ID;
}

export function buildManagedFarmMcpServer(url: string, token: string): McpServerConfig {
  return {
    id: MANAGED_FARM_MCP_SERVER_ID,
    handle: 'our_farm',
    name: '我们的农场',
    description: '由小游戏页面管理的农场代理',
    transport: 'streamable-http',
    url,
    headers: [{ id: 'farm-authorization', key: 'Authorization', value: `Bearer ${token.trim()}` }],
    tools: [{
      name: 'farm_agent',
      description: '让专用农场代理查看或经营我们的农场',
      inputSchema: {
        type: 'object',
        properties: {
          instruction: { type: 'string' },
          context: { type: 'string' }
        },
        required: ['instruction'],
        additionalProperties: false
      },
      enabled: true
    }],
    isActive: true
  };
}

export function mergeManagedFarmMcpServer(servers: McpServerConfig[], managed: McpServerConfig) {
  return [...servers.filter(server => !isManagedFarmMcpServer(server)), managed];
}
