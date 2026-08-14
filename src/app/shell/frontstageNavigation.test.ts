import { describe, expect, it, vi } from 'vitest';
import {
  enterChatWorld,
  enterCollaboratorCollectionScope,
  revealCollaboratorInfo,
  revealCollectionShelf
} from './frontstageNavigation';

describe('enterChatWorld', () => {
  it('switches into chat without touching collection state', () => {
    const setWorld = vi.fn();

    enterChatWorld({ setWorld });

    expect(setWorld).toHaveBeenCalledWith('chat');
    expect(setWorld).toHaveBeenCalledTimes(1);
  });
});

describe('revealCollectionShelf', () => {
  it('lands on the requested collection shelf before revealing collection', () => {
    const events: string[] = [];
    const setCollectionShelf = vi.fn((shelf: string) => events.push(`shelf:${shelf}`));
    const setWorld = vi.fn((world: string) => events.push(`world:${world}`));

    revealCollectionShelf({ setCollectionShelf, setWorld }, 'image');

    expect(events).toEqual(['shelf:image', 'world:collection']);
  });
});

describe('revealCollaboratorInfo', () => {
  it('reuses collection reveal semantics for the info shelf', () => {
    const events: string[] = [];
    const setCollectionShelf = vi.fn((shelf: string) => events.push(`shelf:${shelf}`));
    const setWorld = vi.fn((world: string) => events.push(`world:${world}`));

    revealCollaboratorInfo({ setCollectionShelf, setWorld });

    expect(events).toEqual(['shelf:info', 'world:collection']);
  });
});

describe('enterCollaboratorCollectionScope', () => {
  it('keeps the current shelf when switching collaborator scope', () => {
    const setCollectionShelf = vi.fn();
    const setWorld = vi.fn();

    enterCollaboratorCollectionScope({
      setFrontstageCollaboratorId: vi.fn(),
      setCollectionShelf,
      setWorld
    }, null);

    expect(setCollectionShelf).not.toHaveBeenCalled();
    expect(setWorld).toHaveBeenCalledWith('collection');
  });
});
