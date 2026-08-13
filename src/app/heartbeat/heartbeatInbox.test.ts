import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeHeartbeatInbox, fetchHeartbeatInbox } from './heartbeatInboxClient';
import { createHeartbeatInboxMessage, heartbeatInboxMessageId } from './heartbeatInboxMessage';
import { normalizeHeartbeatInboxConfig } from './heartbeatInboxSettings';
import {
  buildHeartbeatContextPayload,
  heartbeatContextRevision,
  syncHeartbeatContext
} from './heartbeatContextClient';
import {
  createHeartbeatInboxSyncRunner,
  persistThenAcknowledgeHeartbeatInbox
} from './useHeartbeatInboxRuntime';

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

  it('persists the local chat before acknowledging an inbox batch', async () => {
    const order: string[] = [];
    await persistThenAcknowledgeHeartbeatInbox(
      async () => { order.push('persist'); },
      async () => { order.push('acknowledge'); }
    );
    expect(order).toEqual(['persist', 'acknowledge']);
  });

  it('does not acknowledge when local persistence fails', async () => {
    const acknowledge = vi.fn(async () => undefined);
    await expect(persistThenAcknowledgeHeartbeatInbox(
      async () => { throw new Error('database write failed'); },
      acknowledge
    )).rejects.toThrow('database write failed');
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it('coalesces repeated wake events into one follow-up sync', async () => {
    const signals: AbortSignal[] = [];
    const complete: Array<() => void> = [];
    const runner = createHeartbeatInboxSyncRunner(async (signal) => {
      signals.push(signal);
      await new Promise<void>((resolve) => complete.push(resolve));
    });

    runner.request();
    runner.request();
    runner.request();
    expect(signals).toHaveLength(1);

    complete.shift()?.();
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    runner.stop();
  });

  it('aborts the old request and reruns after inbox configuration changes', async () => {
    const signals: AbortSignal[] = [];
    const complete: Array<() => void> = [];
    const runner = createHeartbeatInboxSyncRunner(async (signal) => {
      signals.push(signal);
      await new Promise<void>((resolve) => complete.push(resolve));
    });

    runner.request();
    runner.request(true);
    expect(signals[0]?.aborted).toBe(true);

    complete.shift()?.();
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    runner.stop();
  });

  it('builds context only from ordinary messages in the selected conversation', () => {
    const payload = buildHeartbeatContextPayload({
      id: 'bound-conversation',
      title: '绑定对话',
      collaboratorId: 'yemingzhou',
      messages: [
        { id: 'user-1', role: 'user', content: '普通用户消息', timestamp: 100, origin: 'user-input' },
        { id: 'heartbeat-inbox:event-1', role: 'assistant', content: '已收取主动消息', timestamp: 200, origin: 'assistant-reply' },
        { id: 'tool-1', role: 'assistant', content: '工具记录', timestamp: 300, origin: 'tool-runtime' },
        { id: 'assistant-1', role: 'assistant', content: '普通回复', timestamp: 400, origin: 'assistant-reply' }
      ],
      pinnedAt: null,
      updatedAt: 400
    }, 'yemingzhou', '角色设定');

    expect(payload).toEqual({
      collaboratorId: 'yemingzhou',
      conversationId: 'bound-conversation',
      systemPrompt: '角色设定',
      messages: [
        { id: 'user-1', role: 'user', content: '普通用户消息', timestamp: 100 },
        { id: 'assistant-1', role: 'assistant', content: '普通回复', timestamp: 400 }
      ]
    });
  });

  it('does not build an empty context without a user message', () => {
    expect(buildHeartbeatContextPayload({
      id: 'empty',
      title: '空对话',
      collaboratorId: 'yemingzhou',
      messages: [{ id: 'assistant-1', role: 'assistant', content: '只有助手', timestamp: 100 }],
      pinnedAt: null,
      updatedAt: 100
    }, 'yemingzhou', '角色设定')).toBeNull();
  });

  it('syncs the selected context through the heartbeat endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      collaboratorId: 'yemingzhou',
      conversationId: 'bound-conversation',
      systemPrompt: '角色设定',
      messages: [{ id: 'user-1', role: 'user' as const, content: '你好', timestamp: 100 }]
    };

    await syncHeartbeatContext(config, payload);
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.endpoint}/context`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) })
    );
    expect(heartbeatContextRevision(payload)).toBe(heartbeatContextRevision({ ...payload }));
  });
});
