import { Suspense } from 'react';
import { AppShellOverlays } from '../AppShellOverlays';
import { AppReplyNotificationStack } from './AppReplyNotificationStack';
import { DesktopAppShellFrame } from './DesktopAppShellFrame';
import { EndlessSummerShell } from '../endless-summer/EndlessSummerShell';
import { PersistenceReadFailureNotice } from './PersistenceReadFailureNotice';
import { WorldFrameBoundary, WorldFrameFallback } from './WorldFrameBoundary';
import type { useAppShellViewController } from './useAppShellViewController';

type AppShellViewProps = ReturnType<typeof useAppShellViewController>;

export function AppShellView({
  activeWorld,
  shellWorld,
  activeChatDensity,
  customization,
  displayPreferences,
  themeTransitionPhase,
  worldPresence,
  collectionSearchOpen,
  collectionCollaboratorSwitchOpen,
  setCollectionCollaboratorSwitchOpen,
  collectionInfoFullscreenOpen,
  setCollectionInfoFullscreenOpen,
  collectionDetailOpen,
  setCollectionDetailOpen,
  collectionOpenCollaboratorBuilderForCreate,
  collectionCreateCustomCollaborator,
  collectionOpenProviderSettings,
  collectionOpenSettings,
  collectionOpenDesktopLocalSettings,
  endlessSummer,
  collectionDeleteCollaborator,
  collaboratorTransitionKey,
  topbarProps,
  chatWorldProps,
  groupWorldProps,
  desktopSidebarProps,
  replyNotificationProps,
  overlaysProps,
  startupThemeReady,
  persistenceReadFailureNotice,
  onRetryPersistenceReadFailure,
  onOpenBackupFromReadFailure,
  isWorldSwitching,
  isCollaboratorTransitionActive,
  backgroundUrl,
  backgroundBlur,
  starStyle,
  appLayoutSurface,
  hasWideLayout,
  showDesktopSidebar,
  effectiveDesktopSidebarCollapsed,
  CollectionWorld,
  ChatWorld,
  GroupWorld,
  worldRetryKeys,
  retryWorldFrame,
  toggleDesktopSidebarCollapsed,
  collectionScopeDrawerOpen,
  collectionFrameInteractive,
  chatFrameInteractive,
  groupFrameInteractive
}: AppShellViewProps) {
  const worldStack = (
    <section className="world-stack">
      {worldPresence.renderCollection && (
        <div
          className={`world-frame collection-frame ${activeWorld === 'collection' ? 'active' : ''} ${collectionFrameInteractive ? 'interactive' : ''} ${worldPresence.hideCollection ? 'occluded' : ''} ${collectionDetailOpen ? 'detail-open' : ''}`}
        >
          <WorldFrameBoundary
            world="collection"
            retryKey={worldRetryKeys.collection}
            onRetry={() => retryWorldFrame('collection')}
          >
            <Suspense fallback={<WorldFrameFallback world="collection" />}>
              <CollectionWorld
                searchOpen={collectionSearchOpen}
                collaboratorSwitchOpen={collectionScopeDrawerOpen}
                onCollaboratorSwitchOpenChange={setCollectionCollaboratorSwitchOpen}
                onDeleteCollaborator={collectionDeleteCollaborator}
                onOpenSettings={collectionOpenSettings}
                infoFullscreenOpen={collectionInfoFullscreenOpen}
                onInfoFullscreenOpenChange={setCollectionInfoFullscreenOpen}
                onDetailOpenChange={setCollectionDetailOpen}
                onOpenCollaboratorBuilderForCreate={collectionOpenCollaboratorBuilderForCreate}
                onCreateCustomCollaborator={collectionCreateCustomCollaborator}
                onOpenProviderSettings={collectionOpenProviderSettings}
                onOpenDesktopLocalSettings={collectionOpenDesktopLocalSettings}
              />
            </Suspense>
          </WorldFrameBoundary>
        </div>
      )}
      {worldPresence.renderChat && (
        <div className={`world-frame chat-frame ${activeWorld === 'chat' ? 'active' : ''} ${chatFrameInteractive ? 'interactive' : ''} ${worldPresence.hideChat ? 'occluded' : ''}`}>
          <WorldFrameBoundary
            world="chat"
            retryKey={worldRetryKeys.chat}
            onRetry={() => retryWorldFrame('chat')}
          >
            <Suspense fallback={<WorldFrameFallback world="chat" />}>
              <ChatWorld {...chatWorldProps} />
            </Suspense>
          </WorldFrameBoundary>
        </div>
      )}
      {worldPresence.renderGroup && (
        <div className={`world-frame group-frame ${activeWorld === 'group' ? 'active' : ''} ${groupFrameInteractive ? 'interactive' : ''} ${worldPresence.hideGroup ? 'occluded' : ''}`}>
          <WorldFrameBoundary
            world="group"
            retryKey={worldRetryKeys.group}
            onRetry={() => retryWorldFrame('group')}
          >
            <Suspense fallback={<WorldFrameFallback world="group" />}>
              <GroupWorld
                {...groupWorldProps}
                shell={{
                  ...groupWorldProps.shell,
                  onExitToRoomSwitch: showDesktopSidebar ? groupWorldProps.shell.onExitToRoomSwitch : undefined
                }}
              />
            </Suspense>
          </WorldFrameBoundary>
        </div>
      )}
    </section>
  );

  return (
    <main
      className={`app-shell app-layout-${appLayoutSurface} ${hasWideLayout ? 'app-layout-wide' : 'app-layout-compact'} ${showDesktopSidebar ? 'has-desktop-sidebar' : 'endless-summer'} ${showDesktopSidebar && effectiveDesktopSidebarCollapsed ? 'desktop-sidebar-collapsed' : ''} ${activeWorld} world-chroma-${shellWorld} chat-render-${activeChatDensity} ${isWorldSwitching ? 'world-switching' : ''} ${isCollaboratorTransitionActive ? 'collaborator-transition-active' : ''} ${collectionScopeDrawerOpen ? 'collaborator-scope-drawer-active' : ''} ${themeTransitionPhase ? `theme-transition-${themeTransitionPhase}` : ''}`}
      style={starStyle}
    >
      {backgroundUrl ? (
        <div className="app-shell-background-override" aria-hidden="true">
          <div
            className="app-shell-background-image"
            style={{
              backgroundImage: `url("${backgroundUrl}")`,
              backgroundSize: customization.backgroundFit,
              opacity: customization.backgroundOpacity,
              filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined
            }}
          />
          <div
            className="app-shell-background-dim"
            style={{
              opacity: customization.backgroundDim
            }}
          />
        </div>
      ) : null}
      <div className="bg-glow bg-glow-top" />
      <div className="bg-glow bg-glow-bottom" />
      <div className="theme-transition-veil" aria-hidden="true" />
      <div className="collaborator-transition-veil" aria-hidden="true" />
      {!startupThemeReady ? <div className="startup-theme-veil" aria-hidden="true" /> : null}
      {showDesktopSidebar ? (
        <DesktopAppShellFrame
          desktopSidebarProps={{
            ...desktopSidebarProps,
            collapsed: effectiveDesktopSidebarCollapsed,
            onToggleCollapsed: toggleDesktopSidebarCollapsed
          }}
        >
          {worldStack}
        </DesktopAppShellFrame>
      ) : (
        <EndlessSummerShell
          activeWorld={activeWorld}
          worldStack={worldStack}
          topbarProps={topbarProps}
          conversations={desktopSidebarProps}
          collaboratorName={endlessSummer.collaboratorName}
          userName={endlessSummer.userName}
          collectionShelf={endlessSummer.collectionShelf}
          customization={customization}
          setCustomization={endlessSummer.setCustomization}
          onOpenChat={endlessSummer.onOpenChat}
          onOpenCollectionShelf={endlessSummer.onOpenCollectionShelf}
          onOpenGroup={endlessSummer.onOpenGroup}
          onCloseCollectionScope={() => setCollectionCollaboratorSwitchOpen(false)}
          onOpenSettingsPage={endlessSummer.onOpenSettingsPage}
          onOpenProviderSettings={endlessSummer.onOpenProviderSettings}
        />
      )}

      <AppReplyNotificationStack {...replyNotificationProps} />
      <PersistenceReadFailureNotice
        notice={persistenceReadFailureNotice}
        onRetry={onRetryPersistenceReadFailure}
        onOpenBackup={onOpenBackupFromReadFailure}
      />
      <AppShellOverlays {...overlaysProps} endlessSummer={!showDesktopSidebar} />
    </main>
  );
}
