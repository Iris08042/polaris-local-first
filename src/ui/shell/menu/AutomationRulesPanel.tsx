import { useEffect, useMemo, useState } from 'react';
import type { I18nTranslator } from '../../../i18n/translator';
import { useI18n } from '../../../i18n/useI18n';
import type { Conversation, Persona, PolarisTriggerRule, PolarisTriggerSchedule } from '../../../types/domain';
import { Icon } from '../../Icon';
import { HeartbeatInboxSettingsCard } from './HeartbeatInboxSettingsCard';

type TriggerFormMode = 'daily' | 'interval';
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

function formatDateTime(value: number | null, i18n: I18nTranslator) {
  if (!value) return i18n.t('settings.automation.unscheduled');
  return new Intl.DateTimeFormat(i18n.language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatSchedule(schedule: PolarisTriggerSchedule, t: I18nTranslator['t']) {
  return schedule.kind === 'daily'
    ? t('settings.automation.scheduleDaily', { time: schedule.time })
    : t('settings.automation.scheduleInterval', { minutes: schedule.everyMinutes });
}

function resolvePersonaName(personas: Persona[], collaboratorId: string, t: I18nTranslator['t']) {
  return personas.find((persona) => persona.id === collaboratorId)?.name ?? t('settings.automation.unknownPersona');
}

function formatConversationUpdatedAt(conversation: Conversation, language: I18nTranslator['language']) {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(conversation.updatedAt));
}

function resolveConversationTitle(conversations: Conversation[], conversationId: string | null) {
  if (!conversationId) return null;
  return conversations.find((conversation) => conversation.id === conversationId)?.title.trim() || null;
}

function isSelectedConversationTarget(
  conversationMode: ConversationSelectMode,
  selectedConversationId: string,
  optionId: string
) {
  return conversationMode === 'fixed' && selectedConversationId === optionId;
}

function buildSchedule(mode: TriggerFormMode, dailyTime: string, intervalMinutes: string) {
  if (mode === 'daily') {
    const trimmedTime = dailyTime.trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmedTime)) return null;
    const [hour = '0', minute = '00'] = trimmedTime.split(':');
    return {
      kind: 'daily' as const,
      time: `${hour.padStart(2, '0')}:${minute}`
    };
  }

  const parsedMinutes = Number(intervalMinutes);
  if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1) return null;
  return {
    kind: 'interval' as const,
    everyMinutes: Math.floor(parsedMinutes)
  };
}

export function AutomationRulesPanel({
  personas,
  conversations,
  triggerRules,
  lockedCollaboratorId = null,
  formInitiallyOpen,
  emptyTitle,
  emptyActionLabel,
  formNote,
  rulesNote,
  onCreateTriggerRule,
  onUpdateTriggerRule,
  onDeleteTriggerRule,
  onTestTriggerRule,
  onCopyTriggerUrl,
  onAfterTestTriggerRule
}: AutomationRulesPanelProps) {
  const i18n = useI18n();
  const { t, language } = i18n;
  const resolvedEmptyTitle = emptyTitle ?? t('settings.automation.defaultEmptyTitle');
  const resolvedEmptyActionLabel = emptyActionLabel === undefined
    ? t('settings.automation.defaultEmptyAction')
    : emptyActionLabel;
  const resolvedFormNote = formNote ?? t('settings.automation.defaultFormNote');
  const resolvedRulesNote = rulesNote ?? t('settings.automation.defaultRulesNote');
  const visiblePersonas = lockedCollaboratorId
    ? personas.filter((persona) => persona.id === lockedCollaboratorId)
    : personas;
  const visibleRules = useMemo(
    () => lockedCollaboratorId
      ? triggerRules.filter((rule) => rule.target.collaboratorId === lockedCollaboratorId)
      : triggerRules,
    [lockedCollaboratorId, triggerRules]
  );
  const firstPersonaId = lockedCollaboratorId ?? visiblePersonas[0]?.id ?? '';
  const [formOpen, setFormOpen] = useState(formInitiallyOpen ?? visibleRules.length === 0);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [collaboratorId, setCollaboratorId] = useState(firstPersonaId);
  const [mode, setMode] = useState<TriggerFormMode>('daily');
  const [dailyTime, setDailyTime] = useState('22:30');
  const [intervalMinutes, setIntervalMinutes] = useState('180');
  const [conversationMode, setConversationMode] = useState<ConversationSelectMode>('follow-latest');
  const [conversationId, setConversationId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [rulesHelpOpen, setRulesHelpOpen] = useState(false);

  const sortedRules = useMemo(
    () => [...visibleRules].sort((left, right) => {
      if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
      return (left.nextRunAt ?? Number.MAX_SAFE_INTEGER) - (right.nextRunAt ?? Number.MAX_SAFE_INTEGER);
    }),
    [visibleRules]
  );
  const hasRules = sortedRules.length > 0;
  const showRulesSection = hasRules || !formOpen;
  const editingRule = editingRuleId
    ? visibleRules.find((rule) => rule.id === editingRuleId) ?? null
    : null;
  const editing = editingRuleId !== null;
  const targetConversationOptions = useMemo(
    () => conversations.filter((conversation) =>
      conversation.collaboratorId === (lockedCollaboratorId ?? collaboratorId)
      && (conversation.activeProjectId ?? null) === null
    ),
    [collaboratorId, conversations, lockedCollaboratorId]
  );

  useEffect(() => {
    if (lockedCollaboratorId && collaboratorId !== lockedCollaboratorId) {
      setCollaboratorId(lockedCollaboratorId);
      return;
    }
    if (!collaboratorId && firstPersonaId) setCollaboratorId(firstPersonaId);
  }, [collaboratorId, firstPersonaId, lockedCollaboratorId]);

  useEffect(() => {
    if (conversationMode !== 'fixed') return;
    if (!conversationId) return;
    if (targetConversationOptions.some((conversation) => conversation.id === conversationId)) return;
    setConversationMode('follow-latest');
    setConversationId('');
  }, [conversationId, conversationMode, targetConversationOptions]);

  const resetForm = () => {
    setEditingRuleId(null);
    setName('');
    setCollaboratorId(firstPersonaId);
    setMode('daily');
    setDailyTime('22:30');
    setIntervalMinutes('180');
    setConversationMode('follow-latest');
    setConversationId('');
    setPrompt('');
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (rule: PolarisTriggerRule) => {
    setEditingRuleId(rule.id);
    setName(rule.name);
    setCollaboratorId(lockedCollaboratorId ?? rule.target.collaboratorId);
    setConversationMode(rule.target.conversationMode === 'fixed' && rule.target.conversationId ? 'fixed' : 'follow-latest');
    setConversationId(rule.target.conversationMode === 'fixed' ? rule.target.conversationId ?? '' : '');
    setPrompt(rule.action.prompt);
    if (rule.schedule.kind === 'daily') {
      setMode('daily');
      setDailyTime(rule.schedule.time);
      setIntervalMinutes('180');
    } else {
      setMode('interval');
      setDailyTime('22:30');
      setIntervalMinutes(String(rule.schedule.everyMinutes));
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const submitForm = () => {
    const schedule = buildSchedule(mode, dailyTime, intervalMinutes);
    if (!schedule) {
      window.alert(mode === 'daily' ? t('settings.automation.invalidDaily') : t('settings.automation.invalidInterval'));
      return;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      window.alert(t('settings.automation.emptyPrompt'));
      return;
    }
    const targetCollaboratorId = lockedCollaboratorId ?? collaboratorId;
    if (!targetCollaboratorId) {
      window.alert(t('settings.automation.missingPersona'));
      return;
    }
    if (conversationMode === 'fixed' && !conversationId) {
      window.alert(t('settings.automation.missingConversation'));
      return;
    }

    if (editing) {
      if (!editingRule) {
        window.alert(t('settings.automation.ruleMissing'));
        closeForm();
        return;
      }
      onUpdateTriggerRule(editingRuleId, {
        name: name.trim() || editingRule.name,
        schedule,
        target: {
          ...editingRule.target,
          collaboratorId: targetCollaboratorId,
          conversationMode,
          conversationId: conversationMode === 'fixed' ? conversationId : null
        },
        action: {
          prompt: trimmedPrompt
        },
        lastError: null
      });
      closeForm();
      return;
    }

    const createdId = onCreateTriggerRule({
      name,
      collaboratorId: targetCollaboratorId,
      conversationMode,
      conversationId: conversationMode === 'fixed' ? conversationId : null,
      schedule,
      prompt: trimmedPrompt
    });
    if (createdId) closeForm();
  };

  return (
    <div className={`automation-rules-panel ${lockedCollaboratorId ? 'automation-rules-panel--collaborator' : 'automation-rules-panel--menu'}`}>
      <HeartbeatInboxSettingsCard
        personas={personas}
        conversations={conversations}
        lockedCollaboratorId={lockedCollaboratorId}
      />
      <section className="menu-section automation-form-section automation-rules-head-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.automation.rulesSection')}</span>
          <p className="menu-section-note">{resolvedRulesNote}</p>
        </div>
        <div className="automation-rules-head-actions">
          {!formOpen ? (
            <div className="mcp-page-actions">
              <button type="button" className="mcp-icon-button mcp-page-action-button" onClick={openCreateForm} aria-label={t('settings.automation.addTriggerAria')}>
                <Icon name="plus" size={14} />
                <span>{t('settings.automation.addRule')}</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`automation-rules-help-toggle ${rulesHelpOpen ? 'automation-rules-help-toggle--open' : ''}`}
            aria-expanded={rulesHelpOpen}
            onClick={() => setRulesHelpOpen((open) => !open)}
          >
            <Icon name="infoCard" size={14} />
            <span>{t('settings.automation.localNotification')}</span>
            <Icon name="chevronDown" size={13} />
          </button>
        </div>
        {rulesHelpOpen ? (
          <div className="automation-rules-help-panel" role="note">
            <strong>{t('settings.automation.helpTitle')}</strong>
            <span>{t('settings.automation.helpDetail')}</span>
          </div>
        ) : null}
      </section>

      {formOpen ? (
        <section className="menu-section automation-form-section">
          <div className="menu-section-head automation-form-head">
            <span className="menu-section-kicker ps-field-label">{editing ? t('settings.automation.editMode') : t('settings.automation.createMode')}</span>
            <p className="menu-section-note ps-field-hint">{editing ? editingRule?.name ?? t('settings.automation.editingCurrent') : resolvedFormNote}</p>
          </div>
          <div className="settings-form automation-settings-form">
            <label className="automation-field ps-field">
              <span className="ps-field-label">{t('settings.automation.nameLabel')}</span>
              <input className="ps-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('settings.automation.namePlaceholder')} />
            </label>

            {lockedCollaboratorId ? null : (
              <label className="automation-field ps-field">
                <span className="ps-field-label">{t('settings.automation.personaLabel')}</span>
                <select className="ps-input" value={collaboratorId} onChange={(event) => setCollaboratorId(event.target.value)}>
                  {visiblePersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>{persona.name}</option>
                  ))}
                </select>
              </label>
            )}

            <fieldset className="automation-field automation-conversation-field ps-field">
              <legend className="ps-field-label automation-field-label-row">
                <span>{t('settings.automation.targetLabel')}</span>
                <small>{t('settings.automation.required')}</small>
              </legend>
              <div className="automation-conversation-list" role="radiogroup" aria-label={t('settings.automation.targetAria')}>
                <button
                  type="button"
                  className={`automation-conversation-option ${conversationMode === 'follow-latest' ? 'selected' : ''}`}
                  role="radio"
                  aria-checked={conversationMode === 'follow-latest'}
                  onClick={() => {
                    setConversationMode('follow-latest');
                    setConversationId('');
                  }}
                >
                  <span>{t('settings.automation.followLatest')}</span>
                  <small>{t('settings.automation.followLatestDetail')}</small>
                </button>
                {targetConversationOptions.map((conversation) => {
                  const selected = isSelectedConversationTarget(conversationMode, conversationId, conversation.id);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`automation-conversation-option ${selected ? 'selected' : ''}`}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setConversationMode('fixed');
                        setConversationId(conversation.id);
                      }}
                    >
                      <span>{conversation.title.trim() || t('settings.automation.untitledConversation')}</span>
                      <small>{formatConversationUpdatedAt(conversation, language)}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mcp-transport-field automation-schedule-field ps-field">
              <span className="ps-field-label automation-field-label-row">
                <span>{t('settings.automation.timeLabel')}</span>
                <small>{t('settings.automation.required')}</small>
              </span>
              <div className="mcp-transport-switch">
                <button type="button" className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}>
                  {t('settings.automation.dailyMode')}
                </button>
                <button type="button" className={mode === 'interval' ? 'active' : ''} onClick={() => setMode('interval')}>
                  {t('settings.automation.intervalMode')}
                </button>
              </div>
              {mode === 'daily' ? (
                <input
                  className="ps-input"
                  type="time"
                  value={dailyTime}
                  onChange={(event) => setDailyTime(event.target.value)}
                  placeholder="22:30"
                />
              ) : (
                <div className="automation-interval-input-wrap">
                  <input
                    className="ps-input"
                    type="number"
                    min="1"
                    step="1"
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(event.target.value)}
                    placeholder="180"
                    inputMode="numeric"
                  />
                  <span>{t('settings.automation.minutesUnit')}</span>
                </div>
              )}
            </div>

            <label className="automation-field ps-field">
              <span className="ps-field-label automation-field-label-row">
                <span>{t('settings.automation.promptLabel')}</span>
                <small>{t('settings.automation.required')}</small>
              </span>
              <textarea
                className="ps-textarea"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t('settings.automation.promptPlaceholder')}
              />
            </label>

            <div className="automation-form-actions">
              <button type="button" className="mcp-btn secondary" onClick={closeForm}>
                {t('settings.automation.cancel')}
              </button>
              <button type="button" className="mcp-btn primary" onClick={submitForm}>
                {editing ? t('settings.automation.save') : t('settings.automation.create')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {showRulesSection ? (
        <section className="menu-section">
          {hasRules ? (
            <div className="automation-rule-list">
              {sortedRules.map((rule) => (
                <article key={rule.id} className={`automation-rule-card ${rule.enabled ? 'enabled' : 'disabled'}`}>
                  <button type="button" className="mcp-btn danger automation-rule-delete-btn" onClick={() => onDeleteTriggerRule(rule.id)} aria-label={t('settings.automation.deleteAria', { name: rule.name })}>
                    <Icon name="x" size={13} />
                    <span className="automation-rule-action-label">{t('settings.automation.delete')}</span>
                  </button>
                  <div className="automation-rule-main">
                    <div className="automation-rule-title-row">
                      <span className={`mcp-server-dot ${rule.enabled ? 'active' : 'inactive'}`} />
                      <strong>{rule.name}</strong>
                    </div>
                    <div className="automation-rule-badges">
                      <span className={`automation-rule-badge ${rule.enabled ? 'active' : 'inactive'}`}>
                        {rule.enabled ? t('settings.automation.enabled') : t('settings.automation.disabled')}
                      </span>
                      {lockedCollaboratorId ? null : (
                        <span className="automation-rule-badge">{resolvePersonaName(personas, rule.target.collaboratorId, t)}</span>
                      )}
                      <span className="automation-rule-badge">
                        {rule.target.conversationMode === 'fixed'
                          ? t('settings.automation.fixedConversation', { title: resolveConversationTitle(conversations, rule.target.conversationId) ?? t('settings.automation.missingConversationTitle') })
                          : t('settings.automation.followLatestBadge')}
                      </span>
                      <span className="automation-rule-badge">{formatSchedule(rule.schedule, t)}</span>
                    </div>
                    <p className="automation-rule-prompt">{rule.action.prompt}</p>
                    <div className="automation-rule-meta">
                      <span>{t('settings.automation.nextRun', { time: formatDateTime(rule.nextRunAt, i18n) })}</span>
                      <span>{t('settings.automation.lastRun', { time: formatDateTime(rule.lastRunAt, i18n) })}</span>
                    </div>
                    {rule.lastError ? <div className="automation-rule-error">{rule.lastError}</div> : null}
                  </div>
                  <div className="automation-rule-actions">
                    <button
                      type="button"
                      className={`ps-toggle-sw ${rule.enabled ? 'ps-toggle-sw--on' : ''}`}
                      aria-label={t('settings.automation.toggleAria', { name: rule.name, status: rule.enabled ? t('settings.automation.enabled') : t('settings.automation.disabled') })}
                      aria-pressed={rule.enabled}
                      onClick={() => onUpdateTriggerRule(rule.id, { enabled: !rule.enabled })}
                    >
                      <span className="ps-toggle-knob" />
                    </button>
                    <button type="button" className="mcp-btn secondary automation-rule-action-btn" onClick={() => openEditForm(rule)} aria-label={t('settings.automation.editAria', { name: rule.name })}>
                      <Icon name="edit" size={14} />
                      <span className="automation-rule-action-label">{t('settings.automation.edit')}</span>
                    </button>
                    <button type="button" className="mcp-btn secondary automation-rule-action-btn" aria-label={t('settings.automation.testAria', { name: rule.name })} onClick={() => {
                      onTestTriggerRule(rule.id);
                      onAfterTestTriggerRule?.();
                    }}>
                      <Icon name="play" size={14} />
                      <span className="automation-rule-action-label">{t('settings.automation.test')}</span>
                    </button>
                    <button type="button" className="mcp-btn secondary automation-rule-action-btn" onClick={() => onCopyTriggerUrl(rule.id)} aria-label={t('settings.automation.copyShortcutAria', { name: rule.name })}>
                      <Icon name="copy" size={14} />
                      <span className="automation-rule-action-label">{t('settings.automation.copy')}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="automation-empty-state">
              <strong>{resolvedEmptyTitle}</strong>
              {resolvedEmptyActionLabel ? (
                <button type="button" className="mcp-btn primary" onClick={openCreateForm}>
                  {resolvedEmptyActionLabel}
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
