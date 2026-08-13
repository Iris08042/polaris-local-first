import { useCallback, useEffect, useState } from 'react';
import {
  fetchHeartbeatModelConfig,
  fetchHeartbeatPromptConfig,
  saveHeartbeatModelConfig,
  saveHeartbeatPromptConfig,
  type HeartbeatModelConfig,
  type HeartbeatPromptConfig
} from '../../../app/heartbeat/heartbeatRuntimeConfigClient';
import { HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT } from '../../../app/heartbeat/heartbeatInboxSettings';

const MASKED_KEY = '••••••••••••••••';

export function HeartbeatRuntimeSettingsPanel() {
  const [modelConfig, setModelConfig] = useState<HeartbeatModelConfig | null>(null);
  const [promptConfig, setPromptConfig] = useState<HeartbeatPromptConfig | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [replacingKey, setReplacingKey] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextModel, nextPrompt] = await Promise.all([
        fetchHeartbeatModelConfig(),
        fetchHeartbeatPromptConfig()
      ]);
      setModelConfig(nextModel);
      setPromptConfig(nextPrompt);
      setApiUrl(nextModel.apiUrl);
      setModel(nextModel.model);
      setApiKey('');
      setReplacingKey(!nextModel.apiKeyConfigured);
      setPrompt(nextPrompt.prompt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取心跳模型和提示词。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, reload);
    return () => window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, reload);
  }, [load]);

  async function saveModel() {
    if (!apiUrl.trim() || !model.trim()) {
      setError('API 地址和模型名称都必须填写。');
      return;
    }
    if (replacingKey && !apiKey.trim()) {
      setError(modelConfig?.apiKeyConfigured ? '请输入新的 API Key，或取消更换。' : '请填写 API Key。');
      return;
    }
    setSavingModel(true);
    setError('');
    setNotice('');
    try {
      const next = await saveHeartbeatModelConfig({
        apiUrl: apiUrl.trim(),
        model: model.trim(),
        ...(replacingKey ? { apiKey: apiKey.trim() } : {})
      });
      setModelConfig(next);
      setApiKey('');
      setReplacingKey(false);
      setNotice('心跳模型设置已保存。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '心跳模型保存失败。');
    } finally {
      setSavingModel(false);
    }
  }

  async function savePrompt() {
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

  return (
    <section className="heartbeat-policy heartbeat-runtime-settings">
      <header className="heartbeat-policy__header">
        <div>
          <h3>心跳模型与提示词</h3>
          <p>这里的模型只供主动消息使用，不影响普通聊天。</p>
        </div>
        <button className="mcp-btn" type="button" onClick={() => void load()} disabled={loading}>刷新</button>
      </header>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>主动消息模型</h4><p>当前来源：{modelConfig?.source === 'heartbeat' ? '独立配置' : '腾讯云共享配置'}</p></div>
        </div>
        <label>API 地址<input className="ps-input" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://…/v1/chat/completions" /></label>
        <label>模型名称<input className="ps-input" value={model} onChange={(event) => setModel(event.target.value)} /></label>
        <div className="heartbeat-runtime-settings__secret">
          <label>API Key
            {modelConfig?.apiKeyConfigured && !replacingKey
              ? <input className="ps-input" type="password" value={MASKED_KEY} readOnly aria-label="API Key 已配置" />
              : <input className="ps-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="请输入 API Key" autoComplete="new-password" />}
          </label>
          {modelConfig?.apiKeyConfigured && <button className="mcp-btn" type="button" onClick={() => {
            setApiKey('');
            setReplacingKey(current => !current);
          }}>{replacingKey ? '取消更换' : '更换密钥'}</button>}
        </div>
        <p className="heartbeat-policy__note">{modelConfig?.apiKeyConfigured ? '密钥已配置；黑色圆点只表示已保存，真实密钥不会返回到页面。' : '尚未配置密钥。'}</p>
        <button className="heartbeat-policy__save" type="button" onClick={() => void saveModel()} disabled={savingModel}>{savingModel ? '正在保存…' : '保存模型设置'}</button>
      </div>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>主动消息提示词</h4><p>当前来源：{promptConfig?.source === 'heartbeat' ? '独立配置' : promptConfig?.source === 'file' ? '服务器文件' : promptConfig?.source === 'environment' ? '腾讯云环境变量' : '代码默认值'}</p></div>
        </div>
        <textarea className="ps-input heartbeat-runtime-settings__prompt" rows={13} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <p className="heartbeat-policy__note">可以使用 {'${currentTime}'}、{'${diffMinutes}'} 和 {'${weatherContext}'}；投递格式、连续心理活动和防重复规则由系统自动附加。</p>
        <button className="heartbeat-policy__save" type="button" onClick={() => void savePrompt()} disabled={savingPrompt}>{savingPrompt ? '正在保存…' : '保存提示词'}</button>
      </div>

      {(error || notice) && <p className={`heartbeat-policy-state${error ? ' heartbeat-policy-state--error' : ''}`}>{error || notice}</p>}
    </section>
  );
}
