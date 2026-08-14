import { describe, expect, it } from 'vitest';
import { deriveAppShellState } from './deriveAppShellState';
import type { Persona } from '../../types/domain';

const persona = {
  id: 'aa',
  name: '用户'
} as Persona;

const baseArgs = {
  activeThemePreview: null,
  personas: [persona],
  frontstageCollaboratorId: 'aa',
  activeConversationTitle: 'Chat',
  activeConversationCollaboratorId: 'aa',
  activeConversationMessageCount: 0,
  collectionRenderItemCount: 0,
    labels: {
      collectionWorld: 'Rooms',
      chatWorld: 'Chat',
      unnamedConversation: 'Untitled conversation'
    }
};

describe('deriveAppShellState', () => {
  it('uses the frontstage collaborator as the chat topbar root', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      personas: [
        persona,
        {
          id: 'bb',
          name: 'BB'
        } as Persona
      ],
      frontstageCollaboratorId: 'aa',
      activeConversationCollaboratorId: 'bb'
    });

    expect(state.topbarTitle).toBe('用户');
    expect(state.topbarTitleTone).toBe('collaborator');
  });

  it('uses chat message count for chat render density', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      activeConversationMessageCount: 43,
      collectionRenderItemCount: 0
    });

    expect(state.activeChatDensity).toBe('heavy');
  });

  it('uses collection item count for collection render density', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'collection',
      activeConversationMessageCount: 3,
      collectionRenderItemCount: 27
    });

    expect(state.activeChatDensity).toBe('dense');
  });

});
