import { useMemo, useState } from 'react';
import {
  resolveRollingSummarySource,
  ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT,
  ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT,
  updateRollingSummaryForConversation
} from '../../app/chat/rollingSummary';
import { useChatStore } from '../../stores/chatStore';

function formatUpdatedAt(value: number | undefined) {
  if (!value) return '尚未更新';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value);
}

export function RollingSummaryPage({ onBack }: { onBack: () => void }) {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversation = useChatStore((state) => (
    state.conversations.find((item) => item.id === state.activeConversationId) ?? null
  ));
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');
  const source = useMemo(
    () => conversation ? resolveRollingSummarySource(conversation) : null,
    [conversation]
  );

  const updateNow = async () => {
    if (!activeConversationId || running) return;
    setRunning(true);
    setNotice('');
    try {
      await useChatStore.getState().ensureConversationMessagesLoaded(activeConversationId);
      const result = await updateRollingSummaryForConversation(activeConversationId, { force: true });
      setNotice(result.status === 'updated'
        ? `已融合 ${result.messageCount} 条对话`
        : '当前没有新的、已经固定下来的对话');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '更新失败，请稍后再试');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="es-collection-page es-rolling-summary-page" aria-label="滚动摘要">
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label="返回记忆">‹</button>
        <div><h1>滚动摘要</h1><p>Rolling Summary</p></div>
        <span aria-hidden="true">◇</span>
      </header>

      <div className="es-rolling-body">
      <article className="es-rolling-intro">
        <strong>最近这段聊天的连续脉络</strong>
        <small>Current conversation continuity</small>
        <p>最近 {ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT} 条真实消息始终保留原文；更早的内容每累积 {ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT} 条自动融入摘要。</p>
      </article>

      <article className="es-rolling-sheet">
        <header>
          <div><strong>当前摘要</strong><small>Current summary</small></div>
          <time>{formatUpdatedAt(conversation?.rollingSummary?.updatedAt)}</time>
        </header>
        <div className={conversation?.rollingSummary?.content ? 'has-summary' : 'is-empty'}>
          {conversation?.rollingSummary?.content || `还没有需要压缩的旧对话。最近 ${ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT} 条会一直保留原文。`}
        </div>
      </article>

      <div className="es-rolling-stats">
        <span><strong>{source?.unsummarizedMessages.length ?? 0}</strong><small>等待融合<br />Pending</small></span>
        <span><strong>{source?.bufferedMessages.length ?? 0}</strong><small>原文缓冲<br />Raw buffer</small></span>
      </div>

      <button type="button" className="es-rolling-sync" onClick={() => { void updateNow(); }} disabled={!conversation || running}>
        {running ? '正在更新…' : '立即同步一次'}
        <small>{running ? 'Updating' : 'Sync now'}</small>
      </button>
      {notice ? <p className="es-rolling-notice" role="status">{notice}</p> : null}
      <p className="es-rolling-footnote">摘要只负责衔接当前聊天，可随原始记录重建；长期事实仍交给 Ombre Brain。</p>
      </div>
    </section>
  );
}
