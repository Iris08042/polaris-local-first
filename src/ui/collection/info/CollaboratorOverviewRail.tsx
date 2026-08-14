import { useState } from 'react';
import { runSelectionAction } from '../../haptics';
import type { CollaboratorInfoOverviewItem } from '../../../app/collection/buildCollaboratorInfoOverview';
import { PersonaAvatar } from '../../collaborator/PersonaAvatar';
import { CollaboratorCreatePicker } from '../../worlds/chat/collaborator/CollaboratorCreatePicker';
import { CollectionFloatingCreateAction } from '../grid/CollectionFloatingCreateAction';
import { displayTitleClassName } from '../../titleTypography';
import { Icon } from '../../Icon';
import type { I18nKey } from '../../../i18n/messages';
import { useI18n } from '../../../i18n/useI18n';

type CollaboratorOverviewRailProps = {
  items: CollaboratorInfoOverviewItem[];
  editing: boolean;
  onSelectCollaborator: (collaboratorId: string) => void;
  onToggleCollaboratorPinned: (collaboratorId: string) => void;
  onCreateFromBuilder: () => void;
  onCreateCustomCollaborator: () => void;
  onOpenProviderSettings: () => void;
};

const COUNT_LABEL_KEYS = {
  collection: {
    one: 'collaborator.overview.collectionCountOne',
    many: 'collaborator.overview.collectionCountMany'
  },
  image: {
    one: 'collaborator.overview.imageCountOne',
    many: 'collaborator.overview.imageCountMany'
  },
  conversation: {
    one: 'collaborator.overview.conversationCountOne',
    many: 'collaborator.overview.conversationCountMany'
  },
} satisfies Record<string, { one: I18nKey; many: I18nKey }>;

function countKey(kind: keyof typeof COUNT_LABEL_KEYS, count: number) {
  return COUNT_LABEL_KEYS[kind][count === 1 ? 'one' : 'many'];
}

export function CollaboratorOverviewRail({
  items,
  editing,
  onSelectCollaborator,
  onToggleCollaboratorPinned,
  onCreateFromBuilder,
  onCreateCustomCollaborator,
  onOpenProviderSettings
}: CollaboratorOverviewRailProps) {
  const { t, formatNumber } = useI18n();
  const [createPickerOpen, setCreatePickerOpen] = useState(false);
  const hasCollaborators = items.length > 0;

  return (
    <>
      <div className="collaborator-overview-rail" role="list" aria-label={t('collaborator.overview.aria')}>
        {!hasCollaborators ? (
          <div className="collaborator-overview-empty empty-state-floating">
            <span className="empty-state-icon" aria-hidden="true">
              <Icon name="polarisStar" size={24} />
            </span>
            <p className="empty-state-title">{t('collaborator.overview.emptyTitle')}</p>
            <p className="empty-state-hint">{t('collaborator.overview.emptyHint')}</p>
            <div className="collaborator-overview-empty-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={(event) => {
                  runSelectionAction(() => setCreatePickerOpen(true), { element: event.currentTarget });
                }}
              >
                <Icon name="plus" size={15} />
                <span>{t('collaborator.overview.create')}</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={(event) => {
                  runSelectionAction(onOpenProviderSettings, { element: event.currentTarget });
                }}
              >
                <Icon name="providerRoute" size={15} />
                <span>{t('collaborator.overview.providerSettings')}</span>
              </button>
            </div>
          </div>
        ) : null}
        {items.map((item) => (
          <div key={item.id} role="listitem" className="collaborator-overview-slot">
            {editing ? (
              <button
                type="button"
                className={`card-pin-badge collaborator-overview-pin ${item.pinnedAt ? 'active' : ''}`}
                aria-label={item.pinnedAt
                  ? t('collaborator.overview.unpinAria', { name: item.name })
                  : t('collaborator.overview.pinAria', { name: item.name })}
                onClick={(event) => {
                  event.stopPropagation();
                  runSelectionAction(() => onToggleCollaboratorPinned(item.id), { element: event.currentTarget });
                }}
              >
                <Icon name="pin" size={12} />
              </button>
            ) : null}
            <button
              type="button"
              className={`collaborator-overview-card ${item.pinnedAt ? 'pinned' : ''} ${editing ? 'editing' : ''}`}
              aria-label={t('collaborator.overview.openAria', { name: item.name })}
              aria-disabled={editing || undefined}
              onClick={(event) => {
                if (editing) return;
                runSelectionAction(() => onSelectCollaborator(item.id), { element: event.currentTarget });
              }}
            >
              {item.modelLabel && (
                <div className="collaborator-overview-card-head">
                  <span className="collaborator-overview-card-model">{item.modelLabel}</span>
                </div>
              )}
              <div className="collaborator-overview-card-main">
                <div className="collaborator-overview-card-copy">
                  <span className="collaborator-overview-card-title-row">
                    <PersonaAvatar
                      role="assistant"
                      seed={item.id}
                      assetId={item.assistantAvatarAssetId}
                      shape={item.assistantAvatarShape}
                      size={24}
                      className="collaborator-overview-card-avatar"
                    />
                    {item.pinnedAt ? (
                      <span className="collaborator-overview-card-pin-mark" aria-hidden="true">
                        <Icon name="polarisStar" size={11} />
                      </span>
                    ) : null}
                    <strong className={displayTitleClassName(item.name)}>{item.name}</strong>
                  </span>
                  <p>{item.summary}</p>
                </div>
                <div className="collaborator-overview-card-metrics">
                  <span>{t(countKey('collection', item.collectionCount), { count: formatNumber(item.collectionCount) })}</span>
                  <span>{t(countKey('image', item.imageCount), { count: formatNumber(item.imageCount) })}</span>
                  <span>{t(countKey('conversation', item.conversationCount), { count: formatNumber(item.conversationCount) })}</span>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
      <CollectionFloatingCreateAction
        label={createPickerOpen ? t('collaborator.info.closeCreateAction') : t('collaborator.info.createAction')}
        expanded={createPickerOpen}
        onPress={() => setCreatePickerOpen((current) => !current)}
      >
        {createPickerOpen ? (
          <CollaboratorCreatePicker
            showCloseButton={false}
            onCloseCreatePicker={() => setCreatePickerOpen(false)}
            onCreateFromBuilder={() => {
              setCreatePickerOpen(false);
              onCreateFromBuilder();
            }}
            onCreateCustomCollaborator={() => {
              setCreatePickerOpen(false);
              onCreateCustomCollaborator();
            }}
          />
        ) : null}
      </CollectionFloatingCreateAction>
    </>
  );
}
