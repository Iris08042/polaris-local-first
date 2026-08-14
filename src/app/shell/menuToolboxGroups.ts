import type { PolarisToolPromptGroup } from '../../engines/tool-protocol/assistantToolProtocolTypes';
import { POLARIS_TOOLBOX_PROMPT_GROUP_ORDER } from '../../engines/tool-protocol/toolPromptPreferences';

export function getVisibleToolboxPromptGroups({
  desktopLocalAvailable
}: {
  desktopLocalAvailable: boolean;
}): PolarisToolPromptGroup[] {
  return POLARIS_TOOLBOX_PROMPT_GROUP_ORDER.filter((group) => (
    group !== 'memory'
    && group !== 'memoryRecall'
    && group !== 'memoryWrite'
    && (group !== 'desktop' || desktopLocalAvailable)
  ));
}

export function countEnabledVisibleToolboxGroups(
  preferences: Record<PolarisToolPromptGroup, boolean>,
  options: { desktopLocalAvailable: boolean }
) {
  return getVisibleToolboxPromptGroups(options).filter((group) => preferences[group]).length;
}
