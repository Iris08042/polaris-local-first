import type { McpServerConfig, Persona } from '../../types/domain';
import { isManagedFarmMcpServer } from '../farm/managedFarmMcp';

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
    isManagedFarmMcpServer(server) || selectedServerIds.has(server.id)
  ));
}
