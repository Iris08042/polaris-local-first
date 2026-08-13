import type { Conversation, Persona, PolarisTriggerRule, PolarisTriggerSchedule } from '../../../types/domain';
import { useI18n } from '../../../i18n/useI18n';
import { useRef, useState } from 'react';
import { Icon } from '../../Icon';
import { AutomationRulesPanel, type HeartbeatSettingsTab } from './AutomationRulesPanel';

const HEARTBEAT_SETTINGS_TABS: Array<{ id: HeartbeatSettingsTab; label: string }> = [
  { id: 'model', label: '模型' },
  { id: 'prompt', label: '提示词' },
  { id: 'policy', label: '策略配置' },
  { id: 'inbox', label: '云端收件箱' }
];

type MenuAutomationPageProps = {
  personas: Persona[];
  conversations: Conversation[];
  triggerRules: PolarisTriggerRule[];
  onBack: () => void;
  onCreateTriggerRule: (seed: {
    collaboratorId: string;
    conversationMode?: PolarisTriggerRule['target']['conversationMode'];
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

export function MenuAutomationPage({
  personas,
  conversations,
  triggerRules,
  onBack,
  onCreateTriggerRule,
  onUpdateTriggerRule,
  onDeleteTriggerRule,
  onTestTriggerRule,
  onCopyTriggerUrl,
  onAfterTestTriggerRule
}: MenuAutomationPageProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<HeartbeatSettingsTab>('model');
  const pageRef = useRef<HTMLDivElement>(null);

  const selectTab = (tab: HeartbeatSettingsTab) => {
    setActiveTab(tab);
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={pageRef} className="menu-sheet-page menu-automation-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.automation.section')}</small>
          <h2>{t('settings.automation.title')}</h2>
          <p>{t('settings.automation.pageHelp')}</p>
        </div>
      </div>

      <div className="heartbeat-settings-tabs" role="tablist" aria-label="主动消息设置分类">
        {HEARTBEAT_SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AutomationRulesPanel
        activeTab={activeTab}
        personas={personas}
        conversations={conversations}
        triggerRules={triggerRules}
        emptyTitle={t('settings.automation.emptyTitle')}
        emptyActionLabel={t('settings.automation.emptyAction')}
        formNote={t('settings.automation.formNote')}
        rulesNote={t('settings.automation.rulesNote')}
        onCreateTriggerRule={onCreateTriggerRule}
        onUpdateTriggerRule={onUpdateTriggerRule}
        onDeleteTriggerRule={onDeleteTriggerRule}
        onTestTriggerRule={onTestTriggerRule}
        onCopyTriggerUrl={onCopyTriggerUrl}
        onAfterTestTriggerRule={onAfterTestTriggerRule}
      />
    </div>
  );
}
