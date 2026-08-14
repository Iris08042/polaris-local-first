import { useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizePersonaDefaultSummary } from '../../../config/persona/personaBaseCatalog';
import type { Persona } from '../../../types/domain';
import { runSelectionAction } from '../../haptics';
import { CollaboratorSigil } from '../../collaborator/CollaboratorSigil';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { Icon } from '../../Icon';
import { WorldMark } from '../../shell/WorldMark';
import { CollaboratorCreatePicker } from '../../worlds/chat/collaborator/CollaboratorCreatePicker';
import { useI18n } from '../../../i18n';

type CollaboratorScopeStripProps = {
  open: boolean;
  personas: Persona[];
  conversationCounts: {
    byCollaboratorId: Record<string, number>;
    total: number;
  };
  collaboratorScopeId: string | null;
  onSelectCollaboratorScope: (collaboratorId: string | null) => void;
  onToggleCollaboratorPinned: (collaboratorId: string) => void;
  onClose: () => void;
  onCreateFromBuilder: () => void;
  onCreateCustomCollaborator: () => void;
  onOpenSettings: () => void;
};

export function CollaboratorScopeStrip({
  open,
  personas,
  conversationCounts,
  collaboratorScopeId,
  onSelectCollaboratorScope,
  onToggleCollaboratorPinned,
  onClose,
  onCreateFromBuilder,
  onCreateCustomCollaborator,
  onOpenSettings
}: CollaboratorScopeStripProps) {
  const { t, formatNumber } = useI18n();
  const [createPickerOpen, setCreatePickerOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [aggregateSpinKey, setAggregateSpinKey] = useState(0);

  if (!open) return null;

  const portalRoot = typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('.app-shell')
    : null;

  const formatSegmentCount = (count: number) => t('collection.scope.segmentCount', { count: formatNumber(count) });
  const triggerAggregateSpin = () => {
    setAggregateSpinKey((current) => current + 1);
  };

  const handleSelect = (collaboratorId: string | null) => {
    if (collaboratorId === collaboratorScopeId) return;
    setCreatePickerOpen(false);
    onSelectCollaboratorScope(collaboratorId);
    onClose();
  };

  const drawer = (
    <section className="collaborator-scope-drawer collaborator-scope-drawer--open" aria-label={t('collection.scope.drawerAria')}>
      <button
        type="button"
        className="collaborator-scope-drawer-scrim"
        aria-label={t('collection.scope.closeDrawerAria')}
        onClick={(event) => {
          runSelectionAction(() => {
            setCreatePickerOpen(false);
            onClose();
          }, { element: event.currentTarget });
        }}
      />

      <aside className="collaborator-scope-drawer-panel" role="dialog" aria-modal="false" aria-label={t('collection.scope.dialogAria')}>
        <div className="collaborator-scope-drawer-head">
          <div className="collaborator-scope-drawer-head-copy">
            <span>{t('collection.scope.title')}</span>
          </div>
          <div className="collaborator-scope-drawer-actions">
            <button
              type="button"
              className={`collaborator-scope-drawer-edit ${editingOpen ? 'active' : ''}`}
              onClick={(event) => {
                runSelectionAction(() => {
                  setCreatePickerOpen(false);
                  setEditingOpen((current) => !current);
                }, { element: event.currentTarget });
              }}
            >
              {editingOpen ? t('collection.scope.done') : t('collection.scope.edit')}
            </button>
            <button
              type="button"
              className="collaborator-scope-drawer-settings"
              onClick={(event) => {
                runSelectionAction(() => {
                  setCreatePickerOpen(false);
                  setEditingOpen(false);
                  onClose();
                  onOpenSettings();
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="settings" size={14} />
              <span>{t('collection.scope.settings')}</span>
            </button>
          </div>
        </div>

        <div className="collaborator-scope-drawer-list" role="tablist" aria-label={t('collection.scope.dialogAria')}>
          <div className={`collaborator-scope-create-shell ${createPickerOpen ? 'collaborator-scope-create-shell--open' : ''}`}>
            <button
              type="button"
              className={`collaborator-scope-card collaborator-scope-card--special collaborator-scope-card--create ${createPickerOpen ? 'active' : ''}`}
              onClick={(event) => {
                runSelectionAction(() => {
                  setEditingOpen(false);
                  setCreatePickerOpen((prev) => !prev);
                }, { element: event.currentTarget });
              }}
              aria-expanded={createPickerOpen}
              aria-label={t('collection.scope.createCollaborator')}
            >
              <span className="collaborator-scope-card-title">
                <span className="collaborator-scope-create-mark" aria-hidden="true">
                  <Icon name="personaCreate" size={18} />
                </span>
                <strong>{t('collection.scope.createCollaborator')}</strong>
              </span>
            </button>
            <CreateActionSheet
              open={createPickerOpen}
              ariaLabel={t('collection.scope.createCollaborator')}
              className="collaborator-create-action-sheet"
              onClose={() => setCreatePickerOpen(false)}
            >
              <CollaboratorCreatePicker
                showCloseButton={false}
                onCloseCreatePicker={() => setCreatePickerOpen(false)}
                onCreateFromBuilder={() => {
                  setCreatePickerOpen(false);
                  onClose();
                  onCreateFromBuilder();
                }}
                onCreateCustomCollaborator={() => {
                  setCreatePickerOpen(false);
                  onClose();
                  onCreateCustomCollaborator();
                }}
              />
            </CreateActionSheet>
          </div>
          <button
            type="button"
            className={`collaborator-scope-card collaborator-scope-card--special collaborator-scope-card--aggregate ${collaboratorScopeId === null ? 'active' : ''}`}
            onClick={(event) => {
              if (editingOpen) return;
              runSelectionAction(() => {
                triggerAggregateSpin();
                handleSelect(null);
              }, { element: event.currentTarget });
            }}
            role="tab"
            aria-selected={collaboratorScopeId === null}
            aria-disabled={editingOpen || undefined}
          >
            <span className="collaborator-scope-card-title">
              <span className="collaborator-scope-aggregate-mark">
                <WorldMark
                  key={aggregateSpinKey}
                  world="chat"
                  spinning={aggregateSpinKey > 0}
                  className="collaborator-scope-aggregate-world-mark"
                />
              </span>
              <strong>{t('collection.scope.allCollaborators')}</strong>
            </span>
            <span className="collaborator-scope-card-meta">
              <span>{t('collection.scope.allRooms')}</span>
            </span>
            <span className="collaborator-scope-card-count">{formatSegmentCount(conversationCounts.total)}</span>
          </button>
          {personas.map((persona) => {
            const deletable = editingOpen;
            const conversationCount = conversationCounts.byCollaboratorId[persona.id] ?? 0;

            return (
              <div
                key={persona.id}
                className={`collaborator-scope-card-shell ${deletable ? 'collaborator-scope-card-shell--editing' : ''}`}
              >
                <button
                  type="button"
                  className={`collaborator-scope-card ${collaboratorScopeId === persona.id ? 'active' : ''} ${persona.pinnedAt ? 'pinned' : ''} ${deletable ? 'collaborator-scope-card--editing' : ''}`}
                  onClick={(event) => {
                    if (editingOpen) return;
                    runSelectionAction(() => handleSelect(persona.id), { element: event.currentTarget });
                  }}
                  role="tab"
                  aria-selected={collaboratorScopeId === persona.id}
                  aria-disabled={editingOpen || undefined}
                >
                  <span className="collaborator-scope-card-title">
                    <span className="collaborator-scope-card-badge">
                      <CollaboratorSigil seed={persona.id} size={13} />
                    </span>
                    {persona.pinnedAt ? (
                      <span className="collaborator-scope-card-pin-mark" aria-hidden="true">
                        <Icon name="polarisStar" size={11} />
                      </span>
                    ) : null}
                    <strong>{persona.name}</strong>
                  </span>
                  <span className="collaborator-scope-card-meta">
                    <span>{normalizePersonaDefaultSummary(persona.description) || t('collection.scope.noSummary')}</span>
                  </span>
                  <span className="collaborator-scope-card-count">{formatSegmentCount(conversationCount)}</span>
                </button>
                {deletable ? (
                  <>
                    <button
                      type="button"
                      className={`collaborator-scope-card-pin ${persona.pinnedAt ? 'active' : ''}`}
                      aria-label={persona.pinnedAt ? t('collection.scope.unpinAria', { name: persona.name }) : t('collection.scope.pinAria', { name: persona.name })}
                      onClick={(event) => {
                        event.stopPropagation();
                        runSelectionAction(() => onToggleCollaboratorPinned(persona.id), { element: event.currentTarget });
                      }}
                    >
                      <Icon name="pin" size={12} />
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
    </section>
  );

  return portalRoot ? createPortal(drawer, portalRoot) : drawer;
}
