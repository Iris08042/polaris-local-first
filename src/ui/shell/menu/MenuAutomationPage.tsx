import type { Conversation, Persona, PolarisTriggerRule, PolarisTriggerSchedule } from '../../../types/domain';
import { useI18n } from '../../../i18n/useI18n';
import { Icon } from '../../Icon';
import { AutomationRulesPanel } from './AutomationRulesPanel';

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

  return (
    <div className="menu-sheet-page menu-automation-page">
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

      <AutomationRulesPanel
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
