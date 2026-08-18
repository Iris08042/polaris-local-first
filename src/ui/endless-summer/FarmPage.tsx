import { useEffect, useMemo, useState } from 'react';
import {
  fetchFarmConfig,
  fetchFarmModels,
  farmEndpoint,
  saveFarmConfig,
  testFarmConnection,
  testFarmModel,
  type FarmPublicConfig,
  type FarmTool
} from '../../app/farm/farmClient';
import {
  buildManagedFarmMcpServer,
  mergeManagedFarmMcpServer
} from '../../app/farm/managedFarmMcp';
import { readHeartbeatInboxConfig } from '../../app/heartbeat/heartbeatInboxSettings';
import { getDefaultProviderPath } from '../../engines/providerProtocol';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { ProviderProtocol } from '../../types/domain';
import { Icon } from '../Icon';

type FarmPageProps = {
  onBack: () => void;
  onOpenAutomation: () => void;
};

const FARM_PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; label: string }> = [
  { value: 'openai-completions', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'gemini-generate-content', label: 'Gemini Generate Content' }
];

const EMPTY_CONFIG: FarmPublicConfig = {
  version: 3,
  humanUrl: 'https://farm.catmemo.fun/',
  agentKeyConfigured: false,
  autonomousEnabled: false,
  longTermGoal: '',
  protocol: 'openai-completions',
  baseUrl: '',
  path: getDefaultProviderPath('openai-completions'),
  model: '',
  apiKeyConfigured: false,
  enabledToolNames: []
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后再试';
}

export function FarmPage({ onBack, onOpenAutomation }: FarmPageProps) {
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [humanUrl, setHumanUrl] = useState(EMPTY_CONFIG.humanUrl);
  const [agentKey, setAgentKey] = useState('');
  const [protocol, setProtocol] = useState<ProviderProtocol>(EMPTY_CONFIG.protocol);
  const [baseUrl, setBaseUrl] = useState('');
  const [path, setPath] = useState(EMPTY_CONFIG.path);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [autonomousEnabled, setAutonomousEnabled] = useState(false);
  const [longTermGoal, setLongTermGoal] = useState('');
  const [tools, setTools] = useState<FarmTool[]>([]);
  const [enabledToolNames, setEnabledToolNames] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [modelLoadResult, setModelLoadResult] = useState<null | { ok: boolean; message: string }>(null);
  const [modelTestResult, setModelTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [saveResult, setSaveResult] = useState<null | { ok: boolean; message: string }>(null);

  const applyConfig = (next: FarmPublicConfig) => {
    setConfig(next);
    setHumanUrl(next.humanUrl);
    setProtocol(next.protocol);
    setBaseUrl(next.baseUrl);
    setPath(next.path);
    setModel(next.model);
    setAutonomousEnabled(next.autonomousEnabled);
    setLongTermGoal(next.longTermGoal || '');
    setEnabledToolNames(next.enabledToolNames);
  };

  useEffect(() => {
    let cancelled = false;
    setBusy('loading');
    fetchFarmConfig()
      .then((next) => { if (!cancelled) applyConfig(next); })
      .catch((reason) => { if (!cancelled) setError(errorText(reason)); })
      .finally(() => { if (!cancelled) setBusy(''); });
    return () => { cancelled = true; };
  }, []);

  const selectedTools = useMemo(() => new Set(enabledToolNames), [enabledToolNames]);
  const modelDraft = () => ({
    protocol,
    baseUrl: baseUrl.trim(),
    path: path.trim(),
    apiKey: apiKey.trim() || undefined,
    model: model.trim()
  });

  const clearSaveResult = () => setSaveResult(null);
  const updateApiRoute = (action: () => void) => {
    action();
    setModels([]);
    setModelLoadResult(null);
    setModelTestResult(null);
    clearSaveResult();
  };
  const updateModel = (value: string) => {
    setModel(value);
    setModelLoadResult(null);
    setModelTestResult(null);
    clearSaveResult();
  };

  const run = async (kind: string, action: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setNotice('');
    try { await action(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(''); }
  };

  const loadModels = async () => {
    if (busy) return;
    setBusy('models');
    setModelLoadResult(null);
    setModelTestResult(null);
    try {
      const result = await fetchFarmModels(modelDraft());
      setModels(result.models);
      setModelLoadResult({
        ok: true,
        message: result.models.length
          ? `已拉取 ${result.models.length} 个模型，请在下方选择`
          : '拉取成功，但接口没有返回模型'
      });
    } catch (reason) {
      setModels([]);
      setModelLoadResult({ ok: false, message: errorText(reason) });
    } finally {
      setBusy('');
    }
  };

  const checkModel = async () => {
    if (busy) return;
    setBusy('model');
    setModelTestResult(null);
    try {
      const result = await testFarmModel(modelDraft());
      setModelTestResult({ ok: true, message: `${result.model}${result.reply ? ` · ${result.reply}` : ''}` });
    } catch (reason) {
      setModelTestResult({ ok: false, message: errorText(reason) });
    } finally {
      setBusy('');
    }
  };

  const checkFarm = () => run('farm', async () => {
    const result = await testFarmConnection(agentKey.trim() || undefined);
    setTools(result.tools);
    if (!enabledToolNames.length) setEnabledToolNames(result.tools.map(tool => tool.name));
    setNotice(`农场已连接，发现 ${result.tools.length} 个可用动作`);
  });

  const save = async () => {
    if (busy) return;
    setSaveResult(null);
    if (tools.length && !enabledToolNames.length) {
      setSaveResult({ ok: false, message: '至少保留一个允许农场代理使用的动作' });
      return;
    }
    if (!baseUrl.trim() || !path.trim() || !model.trim() || (!apiKey.trim() && !config.apiKeyConfigured)) {
      setSaveResult({ ok: false, message: '请填写完整的接口格式、Base URL、API Path、API Key 和模型' });
      return;
    }
    const heartbeat = readHeartbeatInboxConfig();
    if (!heartbeat.endpoint || !heartbeat.token) {
      setSaveResult({ ok: false, message: 'Gateway 配置已失效，请先重新保存主动联系设置' });
      return;
    }
    const runtime = useRuntimeStore.getState();
    const previousServers = runtime.mcpServers;
    setBusy('save');
    try {
      runtime.setMcpServers(mergeManagedFarmMcpServer(
        previousServers,
        buildManagedFarmMcpServer(farmEndpoint(heartbeat.endpoint, 'mcp'), heartbeat.token)
      ));
      await useRuntimeStore.getState().persistToDb();
      const saved = await saveFarmConfig({
        humanUrl: humanUrl.trim(),
        agentKey: agentKey.trim() || undefined,
        autonomousEnabled,
        longTermGoal: longTermGoal.trim(),
        protocol,
        baseUrl: baseUrl.trim(),
        path: path.trim(),
        apiKey: apiKey.trim() || undefined,
        model: model.trim(),
        enabledToolNames
      });
      applyConfig(saved);
      setAgentKey('');
      setApiKey('');
      setSaveResult({ ok: true, message: '农场线路已保存，聊天中的农场入口也已接好' });
    } catch (reason) {
      runtime.setMcpServers(previousServers);
      try { await useRuntimeStore.getState().persistToDb(); } catch { /* 保留原正式配置 */ }
      setSaveResult({ ok: false, message: errorText(reason) });
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="es-farm-page" aria-label="我们的农场">
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label="返回小游戏">‹</button>
        <div><h1>我们的农场</h1><p>一起种下、照看与收获</p></div>
        <span className={`es-farm-status ${config.agentKeyConfigured ? 'ready' : ''}`} aria-label={config.agentKeyConfigured ? '已连接' : '未连接'} />
      </header>

      <div className="es-farm-scroll">
        <article className="es-farm-intro">
          <span><Icon name="sun" size={30} /></span>
          <div><strong>农场是小游戏，不是通用 MCP</strong><p>你和他都从这里进入；技术连接由无尽夏在后台代管。</p></div>
          <button type="button" onClick={() => window.open(humanUrl || config.humanUrl, '_blank', 'noopener,noreferrer')}>打开农场</button>
        </article>

        {error ? <p className="es-farm-message error" role="alert">{error}</p> : null}
        {notice ? <p className="es-farm-message">{notice}</p> : null}

        <section className="es-farm-panel">
          <header><div><strong>农场连接</strong><small>Farm account</small></div><em>{config.agentKeyConfigured ? '已保存 Agent Key' : '等待配置'}</em></header>
          <label><span>顾清瑶的农场页面</span><input value={humanUrl} onChange={(event) => { setHumanUrl(event.target.value); clearSaveResult(); }} placeholder="https://farm.catmemo.fun/ui/..." /></label>
          <label><span>Agent Key</span><input type="password" value={agentKey} onChange={(event) => { setAgentKey(event.target.value); setTools([]); setNotice(''); clearSaveResult(); }} autoComplete="off" placeholder={config.agentKeyConfigured ? '留空则继续使用已保存的 Key' : '粘贴农场 Agent Key'} /></label>
          <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={checkFarm}>{busy === 'farm' ? '正在连接…' : '测试连接并读取动作'}</button>
        </section>

        <section className="es-farm-panel">
          <header><div><strong>农场专用模型</strong><small>Independent model API</small></div><em>{config.apiKeyConfigured ? '密钥已保存在服务器' : '独立于聊天线路'}</em></header>
          <label><span>接口格式</span><select value={protocol} onChange={(event) => {
            const next = event.target.value as ProviderProtocol;
            updateApiRoute(() => { setProtocol(next); setPath(getDefaultProviderPath(next)); });
          }}>{FARM_PROTOCOL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>Base URL</span><input type="url" value={baseUrl} onChange={(event) => updateApiRoute(() => setBaseUrl(event.target.value))} placeholder="https://api.example.com/v1" /></label>
          <label><span>API Path</span><input value={path} onChange={(event) => updateApiRoute(() => setPath(event.target.value))} placeholder={getDefaultProviderPath(protocol)} /></label>
          <label><span>API Key</span><input type="password" value={apiKey} onChange={(event) => updateApiRoute(() => setApiKey(event.target.value))} autoComplete="off" placeholder={config.apiKeyConfigured ? '留空则继续使用已保存的 Key' : '只会保存到 Gateway'} /></label>
          <label><span>模型</span><input value={model} onChange={(event) => updateModel(event.target.value)} placeholder="手动填写模型名" /></label>
          <div className="es-farm-button-row">
            <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={() => { void loadModels(); }}>{busy === 'models' ? '拉取中…' : '拉取模型'}</button>
            <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={() => { void checkModel(); }}>{busy === 'model' ? '正在测试…' : '测试连接'}</button>
          </div>
          {modelLoadResult ? <p className={`es-farm-action-result ${modelLoadResult.ok ? 'success' : 'error'}`} role="status">{modelLoadResult.message}</p> : null}
          {models.length ? <label><span>选择已拉取的模型</span><select value={models.includes(model) ? model : ''} onChange={(event) => updateModel(event.target.value)}><option value="">请选择模型（{models.length}）</option>{models.map(item => <option key={item} value={item}>{item}</option>)}</select></label> : null}
          {modelTestResult ? <p className={`es-farm-action-result ${modelTestResult.ok ? 'success' : 'error'}`} role="status">{modelTestResult.ok ? '连接成功 · ' : '连接失败 · '}{modelTestResult.message}</p> : <p className="es-farm-hint">测试会通过 Gateway 发送一次最小真实请求，不写入聊天、记忆或 OB。</p>}
        </section>

        <section className="es-farm-panel">
          <header><div><strong>自主经营</strong><small>Background play</small></div></header>
          <button type="button" className="es-farm-toggle-row" onClick={() => { setAutonomousEnabled(value => !value); clearSaveResult(); }}>
            <span><b>主动醒来时可以玩农场</b><small>关闭 PWA 后也能由主动消息任务调用</small></span>
            <i className={autonomousEnabled ? 'on' : ''}><u /></i>
          </button>
          <button type="button" className="es-farm-link" onClick={onOpenAutomation}>主动联系的频率与时段仍在原设置里管理 ›</button>
          <label className="es-farm-goal">
            <span>共同经营目标</span>
            <textarea
              value={longTermGoal}
              maxLength={2000}
              onChange={(event) => { setLongTermGoal(event.target.value); clearSaveResult(); }}
              placeholder="例如：一起补全图鉴、探索隐藏内容，并分享值得纪念的新发现。"
            />
            <small>聊天与主动醒来会共同遵循；本轮要求是优先事项，只有明确限制才会收窄行动。</small>
          </label>
        </section>

        <section className="es-farm-panel">
          <header><div><strong>允许的农场动作</strong><small>Tool permissions</small></div><em>{tools.length ? `${enabledToolNames.length} / ${tools.length}` : '连接后显示'}</em></header>
          {tools.length ? <div className="es-farm-tools">{tools.map(tool => (
            <label key={tool.name}>
              <input
                type="checkbox"
                checked={selectedTools.has(tool.name)}
                onChange={() => { setEnabledToolNames(current => current.includes(tool.name) ? current.filter(name => name !== tool.name) : [...current, tool.name]); clearSaveResult(); }}
              />
              <span><strong>{tool.name}</strong><small>{tool.description || '农场动作'}</small></span>
            </label>
          ))}</div> : <p className="es-farm-hint">先测试农场连接。首次连接时默认允许发现的全部动作，你可以在这里逐项关闭。</p>}
        </section>

        <button type="button" className={`es-farm-save ${saveResult ? (saveResult.ok ? 'success' : 'error') : ''}`} disabled={Boolean(busy)} onClick={() => { void save(); }}>{busy === 'save' ? '保存中…' : saveResult ? (saveResult.ok ? '保存成功' : '保存失败') : '保存'}</button>
        {saveResult ? <p className={`es-farm-action-result centered ${saveResult.ok ? 'success' : 'error'}`} role="status">{saveResult.message}</p> : null}
        <p className="es-farm-security">Agent Key 与农场模型 API Key 只保存在 Gateway；页面只读取“是否已配置”，不会回显密钥。</p>
      </div>
    </section>
  );
}
