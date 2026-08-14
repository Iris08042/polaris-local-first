type ModuleLoader<T> = () => Promise<T>;

export function createCachedLoader<T>(loader: ModuleLoader<T>) {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      let request: Promise<T>;
      request = loader().catch((error) => {
        if (pending === request) {
          pending = null;
        }
        throw error;
      });
      pending = request;
    }
    return pending;
  };
}

export function preloadLazyModule(loader: ModuleLoader<unknown>) {
  void loader().catch(() => {
    // Preload failures must not poison startup. The cached loader clears failed
    // imports, so the visible world can try again when React actually renders it.
  });
}

export const loadThinkingSheetModule = createCachedLoader(() =>
  import('../worlds/chat/sheets/ThinkingSheet')
);

export const loadApiProviderSheetModule = createCachedLoader(() =>
  import('../shell/ApiProviderSheet')
);

export const loadMenuSheetModule = createCachedLoader(() =>
  import('../shell/MenuSheet')
);

export const loadCollaboratorBuilderTabModule = createCachedLoader(() =>
  import('../shell/persona/PersonaBuilderTab')
);

export const loadCompanionSetupSheetModule = createCachedLoader(() =>
  import('../sheets/CompanionSetupSheet')
);

export const loadCollectionWorldModule = createCachedLoader(() =>
  import('../worlds/CollectionWorld')
);

export const loadChatWorldModule = createCachedLoader(() =>
  import('../worlds/ChatWorld')
);
