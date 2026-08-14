import type { CollectionShelf, World } from '../../types/domain';

type WorldSetter = {
  setWorld: (world: World) => void;
};

type CollectionWorldSetter = WorldSetter & {
  setCollectionShelf: (shelf: CollectionShelf) => void;
};

type CollaboratorCollectionScopeSetter = CollectionWorldSetter & {
  setFrontstageCollaboratorId: (collaboratorId: string | null) => void;
};

export function enterChatWorld(frontstage: WorldSetter) {
  frontstage.setWorld('chat');
}

export function revealCollectionShelf(frontstage: CollectionWorldSetter, shelf: CollectionShelf) {
  frontstage.setCollectionShelf(shelf);
  frontstage.setWorld('collection');
}

export function revealCollaboratorInfo(frontstage: CollectionWorldSetter) {
  revealCollectionShelf(frontstage, 'info');
}

export function enterCollaboratorCollectionScope(
  frontstage: CollaboratorCollectionScopeSetter,
  collaboratorId: string | null
) {
  frontstage.setFrontstageCollaboratorId(collaboratorId);
  frontstage.setWorld('collection');
}
