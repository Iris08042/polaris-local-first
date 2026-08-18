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
      description: '委托专用农场代理完成一轮默认授权的自主经营，并持续推进图鉴、探索、资源循环和伴侣合作；只有明确限制时才收窄行动',
      inputSchema: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: '本轮优先事项、偏好和明确限制；自主经营授权与长期目标已经默认存在' },
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
