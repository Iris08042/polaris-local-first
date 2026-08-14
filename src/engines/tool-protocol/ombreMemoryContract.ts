import type { McpResolvedToolDefinition } from '../mcpRuntime';
import type { ChatMessage, ToolInvocation } from '../../types/domain';
import type { ToolAction } from '../toolExecutor';

const OMBRE_TOOL_NAMES = new Set(['breath', 'breath_search', 'hold', 'grow', 'dream']);
export const OMBRE_SESSION_GAP_MS = 6 * 60 * 60 * 1000;

function hasOmbreIdentity(value: string | undefined) {
  return /(^|[^a-z0-9])(?:ombre|ob)(?:[^a-z0-9]|$)/i.test(value ?? '');
}

export function resolveOmbreServerIds(tools: McpResolvedToolDefinition[] | undefined) {
  const namesByServer = new Map<string, Set<string>>();
  (tools ?? []).forEach((tool) => {
    const names = namesByServer.get(tool.serverId) ?? new Set<string>();
    names.add(tool.toolName);
    namesByServer.set(tool.serverId, names);
  });
  return new Set([...namesByServer.entries()]
    .filter(([, names]) => names.has('breath') && names.has('hold') && names.has('grow'))
    .map(([serverId]) => serverId));
}

export function isOmbreToolInvocation(invocation: ToolInvocation | undefined) {
  const result = invocation?.mcpResult;
  if (!result || !OMBRE_TOOL_NAMES.has(result.toolName)) return false;
  return hasOmbreIdentity(result.serverName) || hasOmbreIdentity(result.schemaName);
}

export function isOmbreToolAction(action: ToolAction) {
  return action.kind === 'invokeMcpTool'
    && OMBRE_TOOL_NAMES.has(action.toolName)
    && (
      hasOmbreIdentity(action.serverName)
      || hasOmbreIdentity(action.schemaName)
    );
}

function isRealUserMessage(message: ChatMessage) {
  return message.role === 'user'
    && message.origin === 'user-input'
    && !message.toolInvocation
    && Boolean(message.content.trim() || message.attachments?.length || message.cardReference);
}

export function resolveOmbreBreathRequired(
  messages: ChatMessage[],
  tools: McpResolvedToolDefinition[] | undefined
) {
  const ombreServerIds = resolveOmbreServerIds(tools);
  if (ombreServerIds.size === 0) return false;
  const userMessages = messages.filter(isRealUserMessage);
  if (userMessages.length === 0) return false;

  let sessionStart = userMessages[0]!;
  for (let index = 1; index < userMessages.length; index += 1) {
    const current = userMessages[index]!;
    const previous = userMessages[index - 1]!;
    if (current.timestamp - previous.timestamp >= OMBRE_SESSION_GAP_MS) {
      sessionStart = current;
    }
  }

  return !messages.some((message) => {
    const invocation = message.toolInvocation;
    const result = invocation?.mcpResult;
    return message.timestamp >= sessionStart.timestamp
      && invocation?.status === 'executed'
      && result?.toolName === 'breath'
      && result.isError !== true
      && ombreServerIds.has(result.serverId);
  });
}
