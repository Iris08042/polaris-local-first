import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeHeartbeatInbox, fetchHeartbeatInbox } from './heartbeatInboxClient';
import { createHeartbeatInboxMessage, heartbeatInboxMessageId } from './heartbeatInboxMessage';
import { normalizeHeartbeatInboxConfig } from './heartbeatInboxSettings';

const config = {
  enabled: true,
  endpoint: 'https://heartbeat.example.com/api/polaris/heartbeat',
  token: 'secret',
  collaboratorId: 'yemingzhou',
  conversationId: null
};

describe('heartbeat inbox', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes the endpoint and optional conversation', () => {
    expect(normalizeHeartbeatInboxConfig({
      ...config,
      endpoint: ' https://heartbeat.example.com/api/polaris/heartbeat/// ',
      conversationId: ' '
    })).toEqual(config);
  });

  it('sorts pending events by their original creation time', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      events: [
        { id: 'second', content: '第二条', createdAt: 200 },
        { id: 'first', content: '第一条', createdAt: 100 }
      ]
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHeartbeatInbox(config)).resolves.toEqual([
      { id: 'first', content: '第一条', createdAt: 100 },
      { id: 'second', content: '第二条', createdAt: 200 }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.endpoint}/inbox`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' })
      })
    );
  });

  it('acknowledges a persisted batch in one request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await acknowledgeHeartbeatInbox(config, ['first', 'second']);
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.endpoint}/ack`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ids: ['first', 'second'] })
      })
    );
  });

  it('creates a normal assistant message with a stable delivery id', () => {
    const event = { id: 'server-event-1', content: '我刚刚想起你。', createdAt: 1234 };
    const message = createHeartbeatInboxMessage(event, 'yemingzhou', '叶明舟');

    expect(message).toMatchObject({
      id: heartbeatInboxMessageId(event.id),
      role: 'assistant',
      content: event.content,
      timestamp: event.createdAt,
      origin: 'assistant-reply',
      assistantName: '叶明舟',
      speakerCollaboratorId: 'yemingzhou'
    });
  });
});
