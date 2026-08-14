import { useState, type ReactNode } from 'react';
import {
  getProviderModelBindingValue,
  getProviderModelDisplayLabel,
  isBuiltInProviderDisplay
} from '../../apiProviderDisplay';
import type { I18nKey } from '../../../../i18n/messages';
import { useI18n } from '../../../../i18n/useI18n';
import type { McpServerConfig } from '../../../../types/domain';
import { Icon, type IconName } from '../../../Icon';
import { type PersonaTabProps } from '../personaUiShared';
import { CustomRequestSettingsTab } from './CustomRequestSettingsTab';
import { PersonaMcpSettingsPage } from './PersonaMcpSettingsPage';

type RequestSettingsTabProps = PersonaTabProps & {
  onOpenProviderSettings?: () => void;
  mcpServers: McpServerConfig[];
  mcpToolTimeoutSeconds: number;
  onCreateMcpServer: (seed?: Partial<McpServerConfig>) => string;
  onUpdateMcpServer: (serverId: string, patch: Partial<McpServerConfig>) => void;
};

type RequestSettingsPage = 'route' | 'custom' | 'mcp';

const REQUEST_PAGE_META: Array<{
  id: RequestSettingsPage;
  labelKey: I18nKey;
  icon: IconName;
}> = [
  { id: 'route', labelKey: 'request.settings.providerSection', icon: 'providerRoute' },
  { id: 'custom', labelKey: 'request.settings.customSection', icon: 'code' },
  { id: 'mcp', labelKey: 'request.settings.mcpSection', icon: 'mcpServer' }
];

function ProviderBindingSettings({
  activePersona,
  providers = [],
  onUpdatePersona,
  onOpenProviderSettings
}: RequestSettingsTabProps) {
  const { t } = useI18n();
  const fixedProviderId = activePersona?.advanced.providerId?.trim() || '';
  const fixedProvider = providers.find((provider) => provider.id === fixedProviderId) ?? null;
  const hasProviderBinding = Boolean(fixedProviderId || activePersona?.advanced.modelOverride.trim());
  const fixedProviderBuiltIn = fixedProvider ? isBuiltInProviderDisplay(fixedProvider) : false;

  const updateProviderBinding = (providerId: string) => {
    if (!providerId) {
      onUpdatePersona({ advanced: { providerId: '', modelOverride: '' } });
      return;
    }
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return;
    onUpdatePersona({ advanced: { providerId: provider.id, modelOverride: getProviderModelBindingValue(provider) } });
  };

  return (
    <>
      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('request.settings.providerLabel')}</span>
          <span className="ps-field-hint">{t('request.settings.providerHint')}</span>
        </div>
        <select
          className="ps-input"
          value={fixedProviderId}
          onChange={(event) => updateProviderBinding(event.target.value)}
        >
          <option value="">{t('request.settings.followGlobalProvider')}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} · {getProviderModelDisplayLabel(provider)}
            </option>
          ))}
        </select>
        <div className="provider-inline-actions">
          <button
            type="button"
            className="btn-secondary compact"
            onClick={() => onUpdatePersona({ advanced: { providerId: '', modelOverride: '' } })}
            disabled={!hasProviderBinding}
          >
            {t('request.settings.followGlobal')}
          </button>
          {onOpenProviderSettings ? (
            <button
              type="button"
              className="btn-secondary compact"
              onClick={onOpenProviderSettings}
            >
              {t('request.settings.openProviderSettings')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('request.settings.modelLabel')}</span>
          <span className="ps-field-hint">
            {fixedProviderBuiltIn
              ? t('request.settings.builtInModelHint')
              : fixedProvider
                ? t('request.settings.providerModelHint', { name: fixedProvider.name })
                : t('request.settings.globalModelHint')}
          </span>
        </div>
        <input
          className="ps-input ps-input--mono"
          value={fixedProviderBuiltIn && fixedProvider ? getProviderModelDisplayLabel(fixedProvider) : (activePersona?.advanced.modelOverride || '')}
          onChange={(event) => onUpdatePersona({ advanced: { modelOverride: event.target.value } })}
          placeholder={fixedProviderBuiltIn ? t('request.settings.builtInModelPlaceholder') : t('request.settings.modelPlaceholder')}
          disabled={fixedProviderBuiltIn}
        />
      </div>
    </>
  );
}

function RequestSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="request-settings-section">
      <div className="request-settings-section-title">{title}</div>
      {children}
    </div>
  );
}

export function RequestSettingsTab(props: RequestSettingsTabProps) {
  const { t } = useI18n();
  const [activePage, setActivePage] = useState<RequestSettingsPage>('route');

  return (
    <div className="request-settings-flow">
      <div className="room-theme-page-nav request-page-nav" role="tablist" aria-label={t('request.settings.pageNavLabel')}>
        {REQUEST_PAGE_META.map((page) => (
          <button
            key={page.id}
            type="button"
            className={activePage === page.id ? 'active' : ''}
            onClick={() => setActivePage(page.id)}
          >
            <Icon name={page.icon} size={14} />
            <span>{t(page.labelKey)}</span>
          </button>
        ))}
      </div>

      {activePage === 'route' ? (
        <RequestSection title={t('request.settings.providerSection')}>
          <ProviderBindingSettings {...props} />
        </RequestSection>
      ) : null}
      {activePage === 'custom' ? (
        <RequestSection title={t('request.settings.customSection')}>
          <CustomRequestSettingsTab {...props} />
        </RequestSection>
      ) : null}
      {activePage === 'mcp' ? (
        <RequestSection title={t('request.settings.mcpSection')}>
          <PersonaMcpSettingsPage {...props} />
        </RequestSection>
      ) : null}
    </div>
  );
}
