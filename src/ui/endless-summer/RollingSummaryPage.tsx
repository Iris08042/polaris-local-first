import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_MEMORY_SUMMARY_INSTRUCTION,
  resolveMemorySummary,
  resolveMemorySummaryInstruction,
  resolveRollingSummarySource,
  ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT,
  ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT,
  updateRollingSummaryForConversation
} from '../../app/chat/rollingSummary';
import { testApiConnection } from '../../engines/chatApi';
import { discoverProviderModels, type ProviderModelOption } from '../../engines/providerModelDiscovery';
import { getDefaultProviderPath, inferProviderProtocol } from '../../engines/providerProtocol';
import { useChatStore } from '../../stores/chatStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import {
  CONVERSATION_MEMORY_SUMMARY_VERSION,
  type ConversationSummaryModelSettings,
  type ConversationRollingSummary,
  type ProviderProfile,
  type ProviderProtocol
} from '../../types/domain';

const SUMMARY_PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; label: string }> = [
  { value: 'openai-completions', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'gemini-generate-content', label: 'Gemini Generate Content' }
];

function buildSummaryProvider(settings: ConversationSummaryModelSettings): ProviderProfile {
  const protocol = inferProviderProtocol({ protocol: settings.protocol, path: settings.path });
  return {
    id: 'provider-rolling-summary-draft',
    name: '记忆摘要',
    protocol,
    baseUrl: settings.baseUrl?.trim() ?? '',
    path: settings.path?.trim() || getDefaultProviderPath(protocol),
    apiKey: settings.apiKey?.trim() ?? '',
    model: settings.modelOverride?.trim() ?? '',
    capabilities: { images: false, streaming: false, thinking: false }
  };
}

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
  const summaryModelSettings = useRuntimeStore((state) => state.conversationSummaryModel);
  const [modelDraft, setModelDraft] = useState<ConversationSummaryModelSettings>(() => ({
    ...summaryModelSettings
  }));
  const [modelOptions, setModelOptions] = useState<ProviderModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [modelLoadResult, setModelLoadResult] = useState<null | { ok: boolean; message: string }>(null);
  const [modelTestResult, setModelTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [modelSaveResult, setModelSaveResult] = useState<null | { ok: boolean; message: string }>(null);
  const summary = useMemo(
    () => resolveMemorySummary(conversation?.rollingSummary),
    [conversation?.rollingSummary]
  );
  const instruction = resolveMemorySummaryInstruction(summary);
  const source = useMemo(
    () => conversation ? resolveRollingSummarySource(conversation) : null,
    [conversation]
  );

  useEffect(() => {
    setModelDraft({ ...summaryModelSettings });
  }, [summaryModelSettings]);

  const updateModelDraft = (patch: Partial<ConversationSummaryModelSettings>) => {
    setModelDraft((current) => ({ ...current, ...patch }));
    setModelOptions([]);
    setModelLoadResult(null);
    setModelTestResult(null);
    setModelSaveResult(null);
  };

  const saveModelSettings = async () => {
    if (saving) return;
    const provider = buildSummaryProvider(modelDraft);
    if (modelDraft.dedicatedProviderEnabled) {
      if (!provider.baseUrl.startsWith('https://')) {
        setModelSaveResult({ ok: false, message: '需要填写公开 HTTPS Base URL' });
        return;
      }
      if (!provider.apiKey || !provider.model) {
        setModelSaveResult({ ok: false, message: '请填写 API Key 和模型' });
        return;
      }
    }

    const previous = useRuntimeStore.getState().conversationSummaryModel;
    setSaving(true);
    setModelSaveResult(null);
    useRuntimeStore.getState().setConversationSummaryModel({
      ...modelDraft,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      path: provider.path,
      apiKey: provider.apiKey,
      modelOverride: provider.model
    });
    try {
      await useRuntimeStore.getState().persistToDb();
      setModelSaveResult({
        ok: true,
        message: modelDraft.dedicatedProviderEnabled ? '独立摘要线路已保存' : '已改为跟随主聊天'
      });
    } catch (error) {
      useRuntimeStore.getState().setConversationSummaryModel(previous);
      setModelSaveResult({
        ok: false,
        message: error instanceof Error ? error.message : '摘要线路保存失败'
      });
    } finally {
      setSaving(false);
    }
  };

  const loadModels = async () => {
    if (loadingModels) return;
    setLoadingModels(true);
    setModelLoadResult(null);
    setModelTestResult(null);
    const result = await discoverProviderModels({ api: buildSummaryProvider(modelDraft) });
    if (result.ok) {
      setModelOptions(result.models);
      setModelLoadResult({ ok: true, message: `已拉取 ${result.models.length} 个模型，请在下方选择` });
    } else {
      setModelLoadResult({ ok: false, message: result.error });
    }
    setLoadingModels(false);
  };

  const testModelConnection = async () => {
    if (testingModel) return;
    const provider = buildSummaryProvider(modelDraft);
    if (!provider.baseUrl.startsWith('https://') || !provider.apiKey || !provider.model) {
      setModelTestResult({ ok: false, message: '请先填写 Base URL、API Key 和模型' });
      return;
    }
    setTestingModel(true);
    setModelTestResult(null);
    const result = await testApiConnection({ api: provider });
    setModelTestResult(result.ok
      ? { ok: true, message: result.message ?? '连接成功' }
      : { ok: false, message: result.error });
    setTestingModel(false);
  };

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
          <strong>长期理解与待办，会随对话一起整理</strong>
          <small>Long-term memory and todos</small>
          <p>最近 {ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT} 条真实消息仍保留原文；长期摘要与待办每积累 {ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT} 条同时更新，也可以随时提前同步。</p>
        </article>

        <article className="es-rolling-sheet es-rolling-model-settings">
          <header>
            <div><strong>摘要模型</strong><small>Summary model</small></div>
            <button
              type="button"
              className={modelSaveResult ? (modelSaveResult.ok ? 'is-success' : 'is-error') : ''}
              onClick={() => { void saveModelSettings(); }}
              disabled={saving}
            >
              {saving ? '保存中…' : modelSaveResult ? (modelSaveResult.ok ? '保存成功' : '保存失败') : '保存'}
            </button>
          </header>
          {modelSaveResult ? (
            <p className={`es-rolling-model-result ${modelSaveResult.ok ? 'is-success' : 'is-error'}`} role="status">
              {modelSaveResult.message}
            </p>
          ) : null}
          <label className="es-rolling-model-toggle">
            <input
              type="checkbox"
              checked={modelDraft.dedicatedProviderEnabled === true}
              onChange={(event) => updateModelDraft({ dedicatedProviderEnabled: event.target.checked })}
            />
            <span><strong>使用独立线路和 Key</strong><small>关闭时跟随当前聊天模型</small></span>
          </label>
          {modelDraft.dedicatedProviderEnabled ? (
            <div className="es-rolling-model-form">
              <label>
                <span>接口格式</span>
                <select
                  value={inferProviderProtocol({ protocol: modelDraft.protocol, path: modelDraft.path })}
                  onChange={(event) => {
                    const protocol = event.target.value as ProviderProtocol;
                    updateModelDraft({ protocol, path: getDefaultProviderPath(protocol) });
                  }}
                >
                  {SUMMARY_PROTOCOL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Base URL</span>
                <input
                  type="url"
                  value={modelDraft.baseUrl ?? ''}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => updateModelDraft({ baseUrl: event.target.value })}
                />
              </label>
              <label>
                <span>API Path</span>
                <input
                  value={modelDraft.path ?? ''}
                  placeholder="/chat/completions"
                  onChange={(event) => updateModelDraft({ path: event.target.value })}
                />
              </label>
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={modelDraft.apiKey ?? ''}
                  placeholder="填写摘要模型 API Key"
                  onChange={(event) => updateModelDraft({ apiKey: event.target.value })}
                />
              </label>
              <label>
                <span>模型</span>
                <div className="es-rolling-model-picker">
                  <input
                    value={modelDraft.modelOverride ?? ''}
                    placeholder="手动填写模型"
                    onChange={(event) => updateModelDraft({ modelOverride: event.target.value })}
                  />
                  <button type="button" onClick={() => { void loadModels(); }} disabled={loadingModels}>
                    {loadingModels ? '拉取中…' : '拉取模型'}
                  </button>
                </div>
                {modelOptions.length ? (
                  <select
                    className="es-rolling-model-select"
                    value={modelOptions.some((option) => option.id === modelDraft.modelOverride)
                      ? modelDraft.modelOverride
                      : ''}
                    onChange={(event) => {
                      setModelDraft((current) => ({ ...current, modelOverride: event.target.value }));
                      setModelTestResult(null);
                      setModelSaveResult(null);
                    }}
                    aria-label="选择已拉取的摘要模型"
                  >
                    <option value="">请选择已拉取的模型（{modelOptions.length}）</option>
                    {modelOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label ? `${option.label} · ${option.id}` : option.id}</option>
                    ))}
                  </select>
                ) : null}
                {modelLoadResult ? (
                  <small className={`es-rolling-model-result ${modelLoadResult.ok ? 'is-success' : 'is-error'}`} role="status">
                    {modelLoadResult.message}
                  </small>
                ) : null}
              </label>
              <div className="es-rolling-model-test">
                <button type="button" onClick={() => { void testModelConnection(); }} disabled={testingModel}>
                  {testingModel ? '正在测试…' : '测试连接'}
                </button>
                {modelTestResult ? (
                  <span className={`es-rolling-model-result ${modelTestResult.ok ? 'is-success' : 'is-error'}`} role="status">
                    {modelTestResult.ok ? '连接成功 · ' : '连接失败 · '}{modelTestResult.message}
                  </span>
                ) : <span>发送一次最小真实请求，不会修改摘要</span>}
              </div>
            </div>
          ) : (
            <p className="es-rolling-model-following">摘要更新会继续使用当前聊天里的模型和供应商。</p>
          )}
        </article>

        <article className="es-rolling-sheet">
          <header>
            <div><strong>长期摘要与待办</strong><small>Memory and todos</small></div>
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
              {summary?.content || '尚未生成长期摘要与待办。点击“立即同步一次”即可从现有聊天整理。'}
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
        <p className="es-rolling-footnote">手动同步会同时整理长期摘要与待办，并重新累计 50 条；编辑记录或提示词不会改变计数。具体长期事实仍由 Ombre Brain 保存。</p>
      </div>
    </section>
  );
}
