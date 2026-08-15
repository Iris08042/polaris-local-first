import { useMemo, useState } from 'react';
import {
  DEFAULT_MEMORY_SUMMARY_INSTRUCTION,
  resolveMemorySummary,
  resolveMemorySummaryInstruction,
  resolveRollingSummarySource,
  ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT,
  ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT,
  updateRollingSummaryForConversation
} from '../../app/chat/rollingSummary';
import { useChatStore } from '../../stores/chatStore';
import {
  CONVERSATION_MEMORY_SUMMARY_VERSION,
  type ConversationRollingSummary
} from '../../types/domain';

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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState('');
  const summary = useMemo(
    () => resolveMemorySummary(conversation?.rollingSummary),
    [conversation?.rollingSummary]
  );
  const instruction = resolveMemorySummaryInstruction(summary);
  const source = useMemo(
    () => conversation ? resolveRollingSummarySource(conversation) : null,
    [conversation]
  );

  const persistSummaryRecord = async (
    next: ConversationRollingSummary,
    successNotice: string
  ) => {
    if (!activeConversationId || saving) return false;
    const previous = conversation?.rollingSummary ?? null;
    setSaving(true);
    setNotice('');
    useChatStore.getState().setConversationRollingSummary(activeConversationId, next);
    try {
      await useChatStore.getState().persistToDb();
      setNotice(successNotice);
      return true;
    } catch (error) {
      useChatStore.getState().setConversationRollingSummary(activeConversationId, previous);
      setNotice(error instanceof Error ? error.message : '保存失败，请稍后再试');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateNow = async () => {
    if (!activeConversationId || running || saving) return;
    setRunning(true);
    setNotice('');
    try {
      await useChatStore.getState().ensureConversationMessagesLoaded(activeConversationId);
      const result = await updateRollingSummaryForConversation(activeConversationId, { force: true });
      setNotice(result.status === 'updated'
        ? `已分析 ${result.messageCount} 条新对话，并从这里重新累计 ${ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT} 条`
        : '当前没有新的对话需要同步');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '更新失败，请稍后再试');
    } finally {
      setRunning(false);
    }
  };

  const saveSummary = async () => {
    const next: ConversationRollingSummary = {
      version: CONVERSATION_MEMORY_SUMMARY_VERSION,
      content: summaryDraft.trim(),
      throughMessageId: summary?.throughMessageId ?? '',
      updatedAt: Date.now(),
      instruction
    };
    if (await persistSummaryRecord(next, '记忆摘要已保存')) setEditingSummary(false);
  };

  const saveInstruction = async () => {
    const nextInstruction = instructionDraft.trim();
    if (!nextInstruction) {
      setNotice('摘要提示词不能为空');
      return;
    }
    const next: ConversationRollingSummary = {
      version: CONVERSATION_MEMORY_SUMMARY_VERSION,
      content: summary?.content ?? '',
      throughMessageId: summary?.throughMessageId ?? '',
      updatedAt: summary?.updatedAt ?? 0,
      instruction: nextInstruction
    };
    if (await persistSummaryRecord(next, '摘要提示词已保存，将用于后续更新')) {
      setEditingInstruction(false);
    }
  };

  return (
    <section className="es-collection-page es-rolling-summary-page" aria-label="记忆摘要">
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label="返回记忆">‹</button>
        <div><h1>记忆摘要</h1><p>Memory Summary</p></div>
        <span aria-hidden="true">◇</span>
      </header>

      <div className="es-rolling-body">
        <article className="es-rolling-intro">
          <strong>长期稳定的理解，会随对话持续整理</strong>
          <small>Long-term understanding</small>
          <p>最近 {ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT} 条真实消息仍保留原文；记忆摘要每积累 {ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT} 条自动更新，也可以随时提前同步。</p>
        </article>

        <article className="es-rolling-sheet">
          <header>
            <div><strong>当前摘要</strong><small>Current summary</small></div>
            <div className="es-rolling-header-actions">
              <time>{formatUpdatedAt(summary?.updatedAt)}</time>
              <button
                type="button"
                onClick={() => {
                  setSummaryDraft(summary?.content ?? '');
                  setEditingSummary(true);
                  setNotice('');
                }}
                disabled={running || saving}
              >编辑</button>
            </div>
          </header>
          {editingSummary ? (
            <div className="es-rolling-editor">
              <textarea
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                aria-label="编辑记忆摘要"
              />
              <div className="es-rolling-editor-actions">
                <button type="button" onClick={() => setEditingSummary(false)} disabled={saving}>取消</button>
                <button type="button" onClick={() => { void saveSummary(); }} disabled={saving}>保存摘要</button>
              </div>
            </div>
          ) : (
            <div className={summary?.content ? 'has-summary' : 'is-empty'}>
              {summary?.content || '尚未生成记忆摘要。点击“立即同步一次”即可从现有聊天重建。'}
            </div>
          )}
        </article>

        <div className="es-rolling-stats">
          <span><strong>{source?.unsummarizedMessages.length ?? 0}</strong><small>等待整理<br />Pending</small></span>
          <span><strong>{source?.bufferedMessages.length ?? 0}</strong><small>原文上下文<br />Raw context</small></span>
        </div>

        <article className="es-rolling-sheet es-rolling-instruction">
          <header>
            <div><strong>摘要提示词</strong><small>Summary instructions</small></div>
            <button
              type="button"
              onClick={() => {
                setInstructionDraft(instruction || DEFAULT_MEMORY_SUMMARY_INSTRUCTION);
                setEditingInstruction(true);
                setNotice('');
              }}
              disabled={running || saving}
            >编辑</button>
          </header>
          {editingInstruction ? (
            <div className="es-rolling-editor">
              <textarea
                value={instructionDraft}
                onChange={(event) => setInstructionDraft(event.target.value)}
                aria-label="编辑摘要提示词"
              />
              <div className="es-rolling-editor-actions">
                <button type="button" onClick={() => setEditingInstruction(false)} disabled={saving}>取消</button>
                <button type="button" onClick={() => { void saveInstruction(); }} disabled={saving}>保存提示词</button>
              </div>
            </div>
          ) : (
            <details>
              <summary>查看当前提示词</summary>
              <pre>{instruction}</pre>
            </details>
          )}
        </article>

        <button type="button" className="es-rolling-sync" onClick={() => { void updateNow(); }} disabled={!conversation || running || saving}>
          {running ? '正在更新…' : '立即同步一次'}
          <small>{running ? 'Updating' : 'Sync now'}</small>
        </button>
        {notice ? <p className="es-rolling-notice" role="status">{notice}</p> : null}
        <p className="es-rolling-footnote">手动同步会提前处理新对话并重新累计 50 条；编辑摘要或提示词不会改变计数。具体长期事实仍由 Ombre Brain 保存。</p>
      </div>
    </section>
  );
}
