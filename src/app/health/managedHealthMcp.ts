import type { McpServerConfig } from '../../types/domain';
import { healthEndpoint } from './healthClient';

export const MANAGED_HEALTH_MCP_SERVER_ID = 'endless-summer-health';

export function isManagedHealthMcpServer(server: Pick<McpServerConfig, 'id'>) {
  return server.id === MANAGED_HEALTH_MCP_SERVER_ID;
}

export function buildManagedHealthMcpServer(
  heartbeatEndpoint: string,
  token: string
): McpServerConfig {
  return {
    id: MANAGED_HEALTH_MCP_SERVER_ID,
    handle: 'health_now',
    name: '身体近况',
    description: '由身体近况页面管理的 Apple Health 最近数据工具',
    transport: 'streamable-http',
    url: healthEndpoint(heartbeatEndpoint, 'mcp'),
    headers: [{
      id: 'health-authorization',
      key: 'Authorization',
      value: `Bearer ${token.trim()}`
    }],
    tools: [{
      name: 'health_now',
      description: '读取服务器最近收到的睡眠、心率、HRV、静息心率、步行平均心率与步数；不会现场测量，回答时须说明采样时间',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      enabled: true
    }],
    isActive: true
  };
}

export function mergeManagedHealthMcpServer(
  servers: McpServerConfig[],
  managed: McpServerConfig | null
) {
  const remaining = servers.filter(server => !isManagedHealthMcpServer(server));
  return managed ? [...remaining, managed] : remaining;
}
