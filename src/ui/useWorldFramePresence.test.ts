import { describe, expect, it } from 'vitest';
import {
  createHiddenWorldPresence,
  createSettledWorldPresence,
  createSwitchWorldPresence,
  resolveWorldPresenceForRender
} from './useWorldFramePresence';

describe('createSwitchWorldPresence', () => {
  it('renders both worlds during a switch to collection', () => {
    expect(
      createSwitchWorldPresence(createSettledWorldPresence('chat'), 'collection')
    ).toEqual({
      renderChat: true,
      renderCollection: true,
      hideChat: false,
      hideCollection: false
    });
  });
});

describe('createHiddenWorldPresence', () => {
  it('hides only the world we are leaving', () => {
    expect(
      createHiddenWorldPresence(
        {
          renderChat: true,
          renderCollection: true,
          hideChat: false,
          hideCollection: false
        },
        'collection'
      )
    ).toEqual({
      renderChat: true,
      renderCollection: true,
      hideChat: true,
      hideCollection: false
    });
  });
});

describe('createSettledWorldPresence', () => {
  it('keeps only collection mounted after the switch settles', () => {
    expect(createSettledWorldPresence('collection')).toEqual({
      renderChat: false,
      renderCollection: true,
      hideChat: false,
      hideCollection: false
    });
  });

  it('keeps only chat mounted after the switch settles', () => {
    expect(createSettledWorldPresence('chat')).toEqual({
      renderChat: true,
      renderCollection: false,
      hideChat: false,
      hideCollection: false
    });
  });
});

describe('resolveWorldPresenceForRender', () => {
  it('keeps the incoming world mounted on the first render after activeWorld flips', () => {
    expect(
      resolveWorldPresenceForRender(
        createSettledWorldPresence('chat'),
        'chat',
        'collection'
      )
    ).toEqual({
      renderChat: true,
      renderCollection: true,
      hideChat: false,
      hideCollection: false
    });
  });
});
