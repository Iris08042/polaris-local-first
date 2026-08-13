import type { Conversation, Persona, PolarisTriggerRule, PolarisTriggerSchedule } from '../../../types/domain';
import { HeartbeatInboxSettingsCard } from './HeartbeatInboxSettingsCard';
import { HeartbeatPolicyPanel } from './HeartbeatPolicyPanel';
import { HeartbeatRuntimeSettingsPanel } from './HeartbeatRuntimeSettingsPanel';

type ConversationSelectMode = PolarisTriggerRule['target']['conversationMode'];

export type AutomationRulesPanelProps = {
  activeTab?: HeartbeatSettingsTab;
  personas: Persona[];
  conversations: Conversation[];
  triggerRules: PolarisTriggerRule[];
  lockedCollaboratorId?: string | null;
  formInitiallyOpen?: boolean;
  emptyTitle?: string;
  emptyActionLabel?: string | null;
  formNote?: string;
  rulesNote?: string;
  onCreateTriggerRule: (seed: {
    collaboratorId: string;
    conversationMode?: ConversationSelectMode;
    conversationId?: string | null;
    schedule: PolarisTriggerSchedule;
    prompt: string;
    name?: string;
  }) => string | null;
  onUpdateTriggerRule: (ruleId: string, patch: Partial<PolarisTriggerRule>) => void;
  onDeleteTriggerRule: (ruleId: string) => void;
  onTestTriggerRule: (ruleId: string) => void;
  onCopyTriggerUrl: (ruleId: string) => void;
  onAfterTestTriggerRule?: () => void;
};

export type HeartbeatSettingsTab = 'model' | 'prompt' | 'policy' | 'inbox';

export function AutomationRulesPanel({
  activeTab,
  personas,
  conversations,
  lockedCollaboratorId
}: AutomationRulesPanelProps) {
  if (activeTab === undefined) {
    return (
      <div className="automation-panel heartbeat-automation-panel">
        <HeartbeatInboxSettingsCard
          personas={personas}
          conversations={conversations}
          lockedCollaboratorId={lockedCollaboratorId}
        />
        <HeartbeatRuntimeSettingsPanel />
        <HeartbeatPolicyPanel />
      </div>
    );
  }

  return (
    <div className="automation-panel heartbeat-automation-panel">
      <div className="heartbeat-tab-panel" hidden={activeTab !== 'model' && activeTab !== 'prompt'}>
        <HeartbeatRuntimeSettingsPanel section={activeTab === 'prompt' ? 'prompt' : 'model'} />
      </div>
      <div className="heartbeat-tab-panel" hidden={activeTab !== 'policy'}>
        <HeartbeatPolicyPanel />
      </div>
      <div className="heartbeat-tab-panel" hidden={activeTab !== 'inbox'}>
        <HeartbeatInboxSettingsCard
          personas={personas}
          conversations={conversations}
          lockedCollaboratorId={lockedCollaboratorId}
        />
      </div>
    </div>
  );
}
