import type { McpServerConfig } from '../../types/domain';

export const MANAGED_SCHEDULED_MESSAGE_MCP_SERVER_ID = 'polaris-scheduled-message';

export function isManagedScheduledMessageMcpServer(server: Pick<McpServerConfig, 'id'>) {
  return server.id === MANAGED_SCHEDULED_MESSAGE_MCP_SERVER_ID;
}

export function scheduledMessageMcpEndpoint(heartbeatEndpoint: string) {
  const root = heartbeatEndpoint.trim().replace(/\/+$/, '').replace(/\/inbox$/, '');
  return `${root.replace(/\/heartbeat$/, '/scheduled-message')}/mcp`;
}

export function buildManagedScheduledMessageMcpServer(
  heartbeatEndpoint: string,
  token: string
): McpServerConfig {
  return {
    id: MANAGED_SCHEDULED_MESSAGE_MCP_SERVER_ID,
    handle: 'scheduled_message',
    name: '定时主动消息',
    description: '由主动消息 Gateway 管理的一次性定时消息工具',
    transport: 'streamable-http',
    url: scheduledMessageMcpEndpoint(heartbeatEndpoint),
    headers: [{
      id: 'scheduled-message-authorization',
      key: 'Authorization',
      value: `Bearer ${token.trim()}`
    }],
    tools: [{
      name: 'scheduled_message',
      description: '创建、查询、修改或取消一次性定时主动消息；到点后会结合最新上下文重新生成并投递 Bark',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list', 'update', 'cancel'] },
          taskId: { type: 'string' },
          runAt: { type: 'string', description: '包含时区的绝对 ISO 日期时间' },
          prompt: { type: 'string', description: '写给到点后的自己看的提示词，不是最终消息' }
        },
        required: ['action'],
        additionalProperties: false
      },
      enabled: true
    }],
    isActive: true
  };
}

export function mergeManagedScheduledMessageMcpServer(
  servers: McpServerConfig[],
  managed: McpServerConfig | null
) {
  const remaining = servers.filter(server => !isManagedScheduledMessageMcpServer(server));
  return managed ? [...remaining, managed] : remaining;
}
