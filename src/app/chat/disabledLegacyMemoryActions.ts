import type { ToolAction } from '../../engines/toolExecutor';
import type { ChatMessage } from '../../types/domain';
import type { ChatUiToolState, MemoryActions } from './chatPorts';

const LEGACY_MEMORY_DISABLED_MESSAGE = '北极星旧记忆系统已停用，请使用 OB 长期记忆。';

export function createDisabledLegacyMemoryActions(
  ui: Pick<ChatUiToolState, 'setCommandStatus'>
): MemoryActions {
  const rejectWrite = () => ({ ok: false as const, error: LEGACY_MEMORY_DISABLED_MESSAGE });
  const consumeLegacyWrite = (_target: unknown, action: ToolAction) => {
    if (action.kind !== 'writeMemory' && action.kind !== 'writeMemoryDoc') return false;
    ui.setCommandStatus(LEGACY_MEMORY_DISABLED_MESSAGE, true);
    return true;
  };
  const consumeLegacyPreview = (_target: unknown, message: ChatMessage) => {
    if (message.toolInvocation?.kind !== 'writeMemory'
      && message.toolInvocation?.kind !== 'writeMemoryDoc') return false;
    ui.setCommandStatus(LEGACY_MEMORY_DISABLED_MESSAGE, true);
    return true;
  };

  return {
    appendCollaboratorMemories: () => false,
    writeCollaboratorMemoryDoc: rejectWrite,
    readCollaboratorMemoryDoc: async () => null,
    listCollaboratorMemoryDocs: () => [],
    maybeHandleWriteMemoryAction: consumeLegacyWrite,
    applyMemoryPreview: consumeLegacyPreview,
    rollbackMemoryPreview: consumeLegacyPreview
  };
}
