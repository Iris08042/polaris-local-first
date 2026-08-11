import type { Conversation, Persona, PolarisTriggerRule, PolarisTriggerSchedule } from '../../../types/domain';
import { HeartbeatInboxSettingsCard } from './HeartbeatInboxSettingsCard';
import { HeartbeatPolicyPanel } from './HeartbeatPolicyPanel';

type ConversationSelectMode = PolarisTriggerRule['target']['conversationMode'];

export type AutomationRulesPanelProps = {
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

export function AutomationRulesPanel({
  personas,
  conversations,
  lockedCollaboratorId
}: AutomationRulesPanelProps) {
  return (
    <div className="automation-panel heartbeat-automation-panel">
      <HeartbeatInboxSettingsCard
        personas={personas}
        conversations={conversations}
        lockedCollaboratorId={lockedCollaboratorId}
      />
      <HeartbeatPolicyPanel />
    </div>
  );
}
