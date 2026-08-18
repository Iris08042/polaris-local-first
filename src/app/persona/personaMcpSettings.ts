import type { McpServerConfig, Persona } from '../../types/domain';
import { isManagedFarmMcpServer } from '../farm/managedFarmMcp';
import { isManagedScheduledMessageMcpServer } from '../scheduled-message/managedScheduledMessageMcp';

export function resolvePersonaMcpServers(args: {
  persona?: Persona | null;
  mcpServers: McpServerConfig[];
}) {
  const { persona, mcpServers } = args;
  if (!persona || persona.mcp?.inheritGlobal !== false) {
    return mcpServers;
  }

  const selectedServerIds = new Set(persona.mcp.serverIds);
  return mcpServers.filter((server) => (
    isManagedFarmMcpServer(server)
    || isManagedScheduledMessageMcpServer(server)
    || selectedServerIds.has(server.id)
  ));
}
