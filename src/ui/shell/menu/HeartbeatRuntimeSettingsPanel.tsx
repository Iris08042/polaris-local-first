import { useCallback, useEffect, useState } from 'react';
import {
  activateHeartbeatModelProfile,
  deleteHeartbeatModelProfile,
  fetchHeartbeatModelConfig,
  fetchHeartbeatModels,
  fetchHeartbeatPromptConfig,
  saveHeartbeatModelProfile,
  saveHeartbeatPromptConfig,
  testHeartbeatModel,
  type HeartbeatModelConfig,
  type HeartbeatPromptConfig
} from '../../../app/heartbeat/heartbeatRuntimeConfigClient';
import { HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT } from '../../../app/heartbeat/heartbeatInboxSettings';

const MASKED_KEY = '••••••••••••••••';

type HeartbeatRuntimeSettingsPanelProps = {
  section?: 'model' | 'prompt';
};

export function HeartbeatRuntimeSettingsPanel({ section }: HeartbeatRuntimeSettingsPanelProps) {
  const [modelConfig, setModelConfig] = useState<HeartbeatModelConfig | null>(null);
  const [promptConfig, setPromptConfig] = useState<HeartbeatPromptConfig | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [replacingKey, setReplacingKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState<'model' | 'prompt'>('model');

  const editProfile = useCallback((config: HeartbeatModelConfig, id: string) => {
    const profile = config.profiles.find(item => item.id === id);
    if (!profile) return;
    setProfileId(profile.id);
    setProfileName(profile.name);
    setBaseUrl(profile.baseUrl);
    setModel(profile.model);
    setApiKey('');
    setReplacingKey(!profile.apiKeyConfigured);
    setAvailableModels([]);
  }, []);

  const applyModelConfig = useCallback((config: HeartbeatModelConfig) => {
    setModelConfig(config);
    editProfile(config, config.activeProfileId);
  }, [editProfile]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextModel, nextPrompt] = await Promise.all([
        fetchHeartbeatModelConfig(),
        fetchHeartbeatPromptConfig()
      ]);
      applyModelConfig(nextModel);
      setPromptConfig(nextPrompt);
      setPrompt(nextPrompt.prompt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取心跳模型和提示词。');
    } finally {
      setLoading(false);
    }
  }, [applyModelConfig]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, reload);
    return () => window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, reload);
  }, [load]);

  function candidate() {
    return {
      ...(profileId ? { id: profileId } : {}),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      ...(replacingKey ? { apiKey: apiKey.trim() } : {})
    };
  }

  async function switchProfile(id: string) {
    if (id === modelConfig?.activeProfileId) {
      if (modelConfig) editProfile(modelConfig, id);
      return;
    }
    setBusy(true);
    setFeedbackTarget('model');
    setError('');
    setNotice('');
    try {
      const next = await activateHeartbeatModelProfile(id);
      applyModelConfig(next);
      setNotice(`已切换到「${next.profiles.find(item => item.id === id)?.name || '所选方案'}」。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '线路方案切换失败。');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setFeedbackTarget('model');
    if (!profileName.trim() || !baseUrl.trim() || !model.trim()) {
      setError('方案名称、API 基础地址和模型名称都必须填写。');
      return;
    }
    if (replacingKey && !apiKey.trim()) {
      setError(profileId ? '请输入新的 API Key，或取消更换。' : '新方案必须填写 API Key。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await saveHeartbeatModelProfile({
        ...candidate(),
        name: profileName.trim()
      });
      applyModelConfig(next);
      setNotice('线路方案已保存并启用。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '线路方案保存失败。');
    } finally {
      setBusy(false);
    }
  }

  async function loadModels() {
    setFeedbackTarget('model');
    if (!baseUrl.trim()) {
      setError('请先填写 API 基础地址。');
      return;
    }
    if (replacingKey && !apiKey.trim()) {
      setError('请先填写 API Key。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await fetchHeartbeatModels(candidate());
      setAvailableModels(result.models);
      if (!model.trim() && result.models[0]) setModel(result.models[0]);
      setNotice(result.models.length ? `已拉取 ${result.models.length} 个模型。` : '连接成功，但站点没有返回模型列表。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '模型列表拉取失败。');
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setFeedbackTarget('model');
    if (!baseUrl.trim() || !model.trim()) {
      setError('请先填写 API 基础地址并选择模型。');
      return;
    }
    if (replacingKey && !apiKey.trim()) {
      setError('请先填写 API Key。');
      return;
    }
    setBusy(true);
    setTestingConnection(true);
    setError('');
    setNotice('');
    try {
      const result = await testHeartbeatModel(candidate());
      setNotice(`连接成功 · ${result.model}${result.reply ? ` · ${result.reply}` : ''}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '连接测试失败。');
    } finally {
      setBusy(false);
      setTestingConnection(false);
    }
  }

  async function removeProfile() {
    if (!profileId || !modelConfig || modelConfig.profiles.length < 2) return;
    if (!window.confirm(`删除线路方案「${profileName}」吗？`)) return;
    setBusy(true);
    setFeedbackTarget('model');
    setError('');
    setNotice('');
    try {
      const next = await deleteHeartbeatModelProfile(profileId);
      applyModelConfig(next);
      setNotice('线路方案已删除。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '线路方案删除失败。');
    } finally {
      setBusy(false);
    }
  }

  async function savePrompt() {
    setFeedbackTarget('prompt');
    if (!prompt.trim()) {
      setError('心跳提示词不能为空。');
      return;
    }
    setSavingPrompt(true);
    setError('');
    setNotice('');
    try {
      const next = await saveHeartbeatPromptConfig(prompt);
      setPromptConfig(next);
      setPrompt(next.prompt);
      setNotice('心跳提示词已保存。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '心跳提示词保存失败。');
    } finally {
      setSavingPrompt(false);
    }
  }

  if (loading && !modelConfig && !promptConfig) {
    return <div className="heartbeat-policy-state">正在读取心跳模型和提示词…</div>;
  }

  const selectedProfile = profileId ? modelConfig?.profiles.find(item => item.id === profileId) : null;

  return (
    <section className="heartbeat-policy heartbeat-runtime-settings">
      <header className="heartbeat-policy__header">
        <div>
          <h3>{section === 'model' ? '模型' : section === 'prompt' ? '提示词' : '心跳模型与提示词'}</h3>
          <p>{section === 'prompt' ? '决定叶明舟何时、如何主动联系你。' : '这里的模型供主动唤醒和定时消息到点生成使用，不影响普通聊天。'}</p>
        </div>
        <button className="mcp-btn" type="button" onClick={() => void load()} disabled={loading || busy}>刷新</button>
      </header>

      {section !== 'prompt' ? <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>主动消息线路方案</h4><p>切换时会一起更换站点、密钥和模型。</p></div>
          <button className="mcp-btn" type="button" disabled={busy} onClick={() => {
            setProfileId(null);
            setProfileName('');
            setBaseUrl('');
            setModel('');
            setApiKey('');
            setReplacingKey(true);
            setAvailableModels([]);
            setError('');
            setNotice('');
          }}>＋ 新建方案</button>
        </div>

        {modelConfig?.profiles.length ? <label>当前启用方案
          <select className="ps-input" value={modelConfig.activeProfileId} disabled={busy} onChange={(event) => void switchProfile(event.target.value)}>
            {modelConfig.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label> : null}

        <label>方案名称<input className="ps-input" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="例如：肘子、备用站" /></label>
        <label>API 基础地址<input className="ps-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…/v1" /></label>
        <p className="heartbeat-policy__note">只填到 /v1；系统会自动请求 /models 和 /chat/completions。已经填写完整地址时也会自动整理。</p>

        <div className="heartbeat-runtime-settings__model-row">
          <label>模型名称
            <input className="ps-input" list="heartbeat-model-options" value={model} onChange={(event) => setModel(event.target.value)} />
            <datalist id="heartbeat-model-options">{availableModels.map(item => <option key={item} value={item} />)}</datalist>
          </label>
          <button className="mcp-btn" type="button" onClick={() => void loadModels()} disabled={busy}>拉取模型</button>
        </div>

        <div className="heartbeat-runtime-settings__secret">
          <label>API Key
            {selectedProfile?.apiKeyConfigured && !replacingKey
              ? <input className="ps-input" type="password" value={MASKED_KEY} readOnly aria-label="API Key 已配置" />
              : <input className="ps-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="请输入 API Key" autoComplete="new-password" />}
          </label>
          {selectedProfile?.apiKeyConfigured && <button className="mcp-btn" type="button" onClick={() => {
            setApiKey('');
            setReplacingKey(current => !current);
          }}>{replacingKey ? '取消更换' : '更换密钥'}</button>}
        </div>
        <p className="heartbeat-policy__note">{selectedProfile?.apiKeyConfigured ? '密钥已保存；黑色圆点不会泄露真实密钥。' : '新方案需要填写密钥。'}</p>

        <div className="heartbeat-policy__actions heartbeat-runtime-settings__actions">
          <button className="mcp-btn" type="button" onClick={() => void testConnection()} disabled={busy}>{testingConnection ? '正在测试…' : '测试连接'}</button>
          {profileId && (modelConfig?.profiles.length || 0) > 1 ? <button className="heartbeat-policy__delete" type="button" onClick={() => void removeProfile()} disabled={busy}>删除方案</button> : null}
        </div>
        <button className="heartbeat-policy__save" type="button" onClick={() => void saveProfile()} disabled={busy}>{busy ? '正在处理…' : '保存并启用此方案'}</button>
        {feedbackTarget === 'model' && (error || notice) && <p aria-live="polite" className={`heartbeat-policy-state${error ? ' heartbeat-policy-state--error' : ''}`}>{error || notice}</p>}
      </div> : null}

      {section !== 'model' ? <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>主动消息提示词</h4><p>当前来源：{promptConfig?.source === 'heartbeat' ? '独立配置' : promptConfig?.source === 'file' ? '服务器文件' : promptConfig?.source === 'environment' ? '腾讯云环境变量' : '代码默认值'}</p></div>
        </div>
        <textarea className="ps-input heartbeat-runtime-settings__prompt" rows={13} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <p className="heartbeat-policy__note">可以使用 {'${currentTime}'}、{'${diffMinutes}'} 和 {'${weatherContext}'}；投递格式、连续心理活动和防重复规则由系统自动附加。</p>
        <button className="heartbeat-policy__save" type="button" onClick={() => void savePrompt()} disabled={savingPrompt}>{savingPrompt ? '正在保存…' : '保存提示词'}</button>
        {feedbackTarget === 'prompt' && (error || notice) && <p aria-live="polite" className={`heartbeat-policy-state${error ? ' heartbeat-policy-state--error' : ''}`}>{error || notice}</p>}
      </div> : null}
    </section>
  );
}
