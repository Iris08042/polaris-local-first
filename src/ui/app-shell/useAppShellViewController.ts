import { lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  annotateCurrentWorldSwitchThemePhase,
  isRuntimePerformanceDebugEnabled,
  recordWorldSwitchStage
} from '../../app/developer/runtime-performance/runtimePerformanceDebug';
import type { useAppShellController } from './useAppShellController';
import { loadChatWorldModule, loadCollectionWorldModule, preloadLazyModule } from './appShellLazyModules';
import { useCustomFontDomEffects } from '../customFontDomEffects';
import { useAssetObjectUrl } from '../useAssetObjectUrl';
import { isSidebarLayoutSurface, isWideLayoutSurface, shouldShowDesktopSidebar } from '../../app/shell/appLayoutSurface';
import { useAppLayoutSurface, useDesktopSidebarAutoCollapse } from './useAppLayoutSurface';
import { blurChatWorldFocus } from './chatWorldFocusHandoff';
import { isWorldFrameInteractive } from './worldFrameInteractivity';
import type { PersistenceReadFailureNoticeState } from './usePersistenceReadFailureNotice';
import { useAppearanceDomEffects } from '../useAppearanceDomEffects';
import type { World } from '../../types/domain';

type AppShellViewControllerInput = ReturnType<typeof useAppShellController> & {
  startupThemeReady: boolean;
  persistenceReadFailureNotice: PersistenceReadFailureNoticeState;
  onRetryPersistenceReadFailure: () => void;
  onOpenBackupFromReadFailure: () => void;
};

type RenderDensity = AppShellViewControllerInput['activeChatDensity'];
type WorldRetryKeys = Record<World, number>;

function resolveBackgroundBlur(backgroundBlur: number, density: RenderDensity) {
  if (density === 'heavy') return Math.min(backgroundBlur, 8);
  if (density === 'dense') return Math.min(backgroundBlur, 14);
  return backgroundBlur;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function buildStarStyle(customization: AppShellViewControllerInput['customization']): CSSProperties | undefined {
  const starColor = customization.starColor;
  const glow = customization.starGlow;
  const warmth = customization.starWarmth;
  const glowShadowMix = Math.round(28 + glow * 42);
  const glowCoreMix = Math.round(18 + glow * 26);
  const warmMix = Math.round(18 + warmth * 48);
  const endMix = Math.round(28 + warmth * 52);
  const midMix = Math.round(28 + warmth * 30);
  if (!starColor && customization.starOpacity === 0.98 && glow === 0.46 && customization.starScale === 1 && warmth === 0.54) {
    return undefined;
  }
  return {
    ...(starColor ? {
      '--app-star-color': starColor,
      '--app-star-color-soft': `color-mix(in srgb, ${starColor} 72%, #ffffff 28%)`,
      '--app-star-color-mid': `color-mix(in srgb, ${starColor} ${formatPercent(100 - midMix)}, #d8b9ff ${formatPercent(midMix)})`,
      '--app-star-color-warm': `color-mix(in srgb, ${starColor} ${formatPercent(100 - warmMix)}, #f5c3d5 ${formatPercent(warmMix)})`,
      '--app-star-color-end': `color-mix(in srgb, ${starColor} ${formatPercent(100 - endMix)}, #f5d79a ${formatPercent(endMix)})`,
      '--app-star-glow-core': `color-mix(in srgb, ${starColor} ${formatPercent(glowCoreMix)}, #ffffff ${formatPercent(100 - glowCoreMix)})`,
      '--app-star-shadow': `color-mix(in srgb, ${starColor} ${formatPercent(glowShadowMix)}, transparent)`
    } : {}),
    '--app-star-opacity': customization.starOpacity,
    '--app-star-glow-opacity': 0.12 + glow * 0.78,
    '--app-star-aura-opacity': 0.08 + glow * 0.42,
    '--app-star-aura-edge-opacity': (0.08 + glow * 0.42) * 0.65,
    '--app-star-glint-opacity': 0.16 + glow * 0.46,
    '--app-star-glint-edge-opacity': (0.16 + glow * 0.46) * 0.48,
    '--app-star-scale': customization.starScale,
    '--app-star-shadow-blur': `${Math.round(7 + glow * 18)}px`,
    '--app-star-turn-opacity-min': 0.78 * customization.starOpacity,
    '--app-star-turn-opacity-full': customization.starOpacity,
    '--app-star-turn-opacity-rest': 0.86 * customization.starOpacity,
    '--app-star-turn-scale-min': 0.92 * customization.starScale,
    '--app-star-turn-scale-full': customization.starScale,
    '--app-star-turn-scale-rest': 0.94 * customization.starScale,
    '--app-star-loading-aura-opacity': 0.1 + glow * 0.34,
    '--app-star-loading-aura-mix': formatPercent(10 + glow * 34),
    '--app-star-loading-aura-mid-mix': formatPercent(5 + glow * 22)
  } as CSSProperties;
}

function worldModuleLoaderFor(world: World) {
  if (world === 'chat') return loadChatWorldModule;
  return loadCollectionWorldModule;
}

function countFilterNodes(root: Element | null) {
  if (!root || typeof window === 'undefined') {
    return {
      nodeCount: 0,
      backdropNodeCount: 0,
      filterNodeCount: 0
    };
  }

  const nodes = root.querySelectorAll<HTMLElement>('*');
  let backdropNodeCount = 0;
  let filterNodeCount = 0;
  nodes.forEach((node) => {
    const style = window.getComputedStyle(node);
    if (style.backdropFilter && style.backdropFilter !== 'none') {
      backdropNodeCount += 1;
    }
    if (style.filter && style.filter !== 'none') {
      filterNodeCount += 1;
    }
  });

  return {
    nodeCount: nodes.length,
    backdropNodeCount,
    filterNodeCount
  };
}

export function useAppShellViewController(props: AppShellViewControllerInput) {
  const {
    activeWorld,
    shellWorld,
    activeChatDensity,
    customization,
    displayPreferences,
    themeTransitionPhase,
    worldPresence,
    collectionCollaboratorSwitchOpen,
    setCollectionCollaboratorSwitchOpen,
    collectionDetailOpen,
    collaboratorTransitionKey
  } = props;
  const isWorldSwitching = [
    worldPresence.renderChat,
    worldPresence.renderCollection
  ].filter(Boolean).length > 1;
  const [isCollaboratorTransitionActive, setIsCollaboratorTransitionActive] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [worldRetryKeys, setWorldRetryKeys] = useState<WorldRetryKeys>({
    chat: 0,
    collection: 0
  });
  const lastCollaboratorTransitionKeyRef = useRef<string | null>(null);
  const backgroundUrl = useAssetObjectUrl(customization.backgroundAssetId ?? undefined, true);
  const backgroundBlur = resolveBackgroundBlur(customization.backgroundBlur, activeChatDensity);
  const starStyle = buildStarStyle(customization);
  const appLayoutSurface = useAppLayoutSurface();
  const hasWideLayout = isWideLayoutSurface(appLayoutSurface);
  const hasSidebarLayout = isSidebarLayoutSurface(appLayoutSurface);
  const showDesktopSidebar = shouldShowDesktopSidebar(appLayoutSurface, activeWorld);
  const desktopSidebarAutoCollapsed = useDesktopSidebarAutoCollapse(hasSidebarLayout);
  const effectiveDesktopSidebarCollapsed = desktopSidebarCollapsed || desktopSidebarAutoCollapsed;
  const CollectionWorld = useMemo(
    () => lazy(() => loadCollectionWorldModule().then((module) => ({ default: module.CollectionWorld }))),
    [worldRetryKeys.collection]
  );
  const ChatWorld = useMemo(
    () => lazy(() => loadChatWorldModule().then((module) => ({ default: module.ChatWorld }))),
    [worldRetryKeys.chat]
  );
  const retryWorldFrame = (world: World) => {
    setWorldRetryKeys((current) => ({
      ...current,
      [world]: current[world] + 1
    }));
  };
  const toggleDesktopSidebarCollapsed = () => {
    setDesktopSidebarCollapsed(!effectiveDesktopSidebarCollapsed);
  };

  useAppearanceDomEffects(displayPreferences.appearance);
  useCustomFontDomEffects(customization, displayPreferences);

  useEffect(() => {
    const preloadWorldModules = () => {
      (['chat', 'collection'] as const)
        .filter((world) => world !== activeWorld)
        .forEach((world) => preloadLazyModule(worldModuleLoaderFor(world)));
    };

    if (typeof window === 'undefined') {
      preloadWorldModules();
      return undefined;
    }

    const timeoutId = window.setTimeout(preloadWorldModules, 1200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeWorld]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (activeWorld === 'chat' && shellWorld === 'chat') return;
    blurChatWorldFocus(document.activeElement);
  }, [activeWorld, shellWorld]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!showDesktopSidebar) {
      delete document.documentElement.dataset.polarisDesktopSidebar;
      return undefined;
    }

    document.documentElement.dataset.polarisDesktopSidebar = effectiveDesktopSidebarCollapsed ? 'collapsed' : 'expanded';
    return () => {
      delete document.documentElement.dataset.polarisDesktopSidebar;
    };
  }, [effectiveDesktopSidebarCollapsed, showDesktopSidebar]);

  useEffect(() => {
    annotateCurrentWorldSwitchThemePhase(themeTransitionPhase, worldPresence);
  }, [themeTransitionPhase, worldPresence]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (backgroundUrl) {
      document.body.dataset.polarisCustomBackgroundOverride = 'true';
      return () => {
        delete document.body.dataset.polarisCustomBackgroundOverride;
      };
    }

    delete document.body.dataset.polarisCustomBackgroundOverride;
    return undefined;
  }, [backgroundUrl]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isRuntimePerformanceDebugEnabled()) return;
    if (!worldPresence.renderChat || !worldPresence.renderCollection) return;

    const activeRoot = document.querySelector('.world-frame.active');
    const inactiveRoot = document.querySelector('.world-frame:not(.active)');
    const inactiveStats = countFilterNodes(inactiveRoot);
    const activeStats = countFilterNodes(activeRoot);

    recordWorldSwitchStage({
      stage: 'snapshot',
      renderChat: worldPresence.renderChat,
      renderCollection: worldPresence.renderCollection,
      hideChat: worldPresence.hideChat,
      hideCollection: worldPresence.hideCollection,
      themeTransitionPhase,
      activeNodeCount: activeStats.nodeCount,
      inactiveNodeCount: inactiveStats.nodeCount,
      inactiveBackdropNodeCount: inactiveStats.backdropNodeCount,
      inactiveFilterNodeCount: inactiveStats.filterNodeCount
    });
  }, [themeTransitionPhase, worldPresence]);

  useEffect(() => {
    if (lastCollaboratorTransitionKeyRef.current === null) {
      lastCollaboratorTransitionKeyRef.current = collaboratorTransitionKey;
      return;
    }

    if (lastCollaboratorTransitionKeyRef.current === collaboratorTransitionKey) {
      return;
    }

    lastCollaboratorTransitionKeyRef.current = collaboratorTransitionKey;
    let timeoutId: number | null = null;
    setIsCollaboratorTransitionActive(true);
    timeoutId = window.setTimeout(() => {
      setIsCollaboratorTransitionActive(false);
    }, 420);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [collaboratorTransitionKey]);

  useEffect(() => {
    if (!collectionCollaboratorSwitchOpen) return;
    if (!hasSidebarLayout && activeWorld === 'collection') return;
    setCollectionCollaboratorSwitchOpen(false);
  }, [
    activeWorld,
    collectionCollaboratorSwitchOpen,
    hasSidebarLayout,
    setCollectionCollaboratorSwitchOpen
  ]);

  const collectionScopeDrawerOpen =
    !hasSidebarLayout &&
    activeWorld === 'collection' &&
    !worldPresence.hideCollection &&
    collectionCollaboratorSwitchOpen;

  return {
    ...props,
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
    worldRetryKeys,
    retryWorldFrame,
    toggleDesktopSidebarCollapsed,
    collectionScopeDrawerOpen,
    collectionFrameInteractive: isWorldFrameInteractive(activeWorld, shellWorld, 'collection'),
    chatFrameInteractive: isWorldFrameInteractive(activeWorld, shellWorld, 'chat')
  };
}
