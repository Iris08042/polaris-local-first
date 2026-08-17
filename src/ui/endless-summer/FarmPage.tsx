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
import { useRuntimeStore } from '../../stores/runtimeStore';
import { Icon } from '../Icon';

type FarmPageProps = {
  onBack: () => void;
  onOpenAutomation: () => void;
};

const EMPTY_CONFIG: FarmPublicConfig = {
  version: 1,
  humanUrl: 'https://farm.catmemo.fun/',
  agentKeyConfigured: false,
  autonomousEnabled: false,
  baseUrl: '',
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
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [autonomousEnabled, setAutonomousEnabled] = useState(false);
  const [tools, setTools] = useState<FarmTool[]>([]);
  const [enabledToolNames, setEnabledToolNames] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const applyConfig = (next: FarmPublicConfig) => {
    setConfig(next);
    setHumanUrl(next.humanUrl);
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    setAutonomousEnabled(next.autonomousEnabled);
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
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim() || undefined,
    model: model.trim()
  });

  const run = async (kind: string, action: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setNotice('');
    try { await action(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(''); }
  };

  const loadModels = () => run('models', async () => {
    const result = await fetchFarmModels(modelDraft());
    setModels(result.models);
    setNotice(result.models.length ? `读取到 ${result.models.length} 个模型` : '线路可访问，但没有返回模型列表');
  });

  const checkModel = () => run('model', async () => {
    const result = await testFarmModel(modelDraft());
    setNotice(`农场专用模型可用：${result.model}${result.reply ? ` · ${result.reply}` : ''}`);
  });

  const checkFarm = () => run('farm', async () => {
    const result = await testFarmConnection(agentKey.trim() || undefined);
    setTools(result.tools);
    if (!enabledToolNames.length) setEnabledToolNames(result.tools.map(tool => tool.name));
    setNotice(`农场已连接，发现 ${result.tools.length} 个可用动作`);
  });

  const save = () => run('save', async () => {
    if (tools.length && !enabledToolNames.length) throw new Error('至少保留一个允许农场代理使用的动作');
    const saved = await saveFarmConfig({
      humanUrl: humanUrl.trim(),
      agentKey: agentKey.trim() || undefined,
      autonomousEnabled,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim() || undefined,
      model: model.trim(),
      enabledToolNames
    });
    const heartbeat = readHeartbeatInboxConfig();
    if (!heartbeat.endpoint || !heartbeat.token) throw new Error('Gateway 配置已失效，请先重新保存主动联系设置');
    const runtime = useRuntimeStore.getState();
    runtime.setMcpServers(mergeManagedFarmMcpServer(
      runtime.mcpServers,
      buildManagedFarmMcpServer(farmEndpoint(heartbeat.endpoint, 'mcp'), heartbeat.token)
    ));
    await useRuntimeStore.getState().persistToDb();
    applyConfig(saved);
    setAgentKey('');
    setApiKey('');
    setNotice('农场设置已保存，聊天中的农场入口也已自动接好');
  });

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
          <label><span>农场页面</span><input value={humanUrl} onChange={(event) => setHumanUrl(event.target.value)} placeholder="https://farm.catmemo.fun/" /></label>
          <label><span>Agent Key</span><input type="password" value={agentKey} onChange={(event) => setAgentKey(event.target.value)} autoComplete="off" placeholder={config.agentKeyConfigured ? '留空则继续使用已保存的 Key' : '粘贴农场 Agent Key'} /></label>
          <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={checkFarm}>{busy === 'farm' ? '正在连接…' : '测试连接并读取动作'}</button>
        </section>

        <section className="es-farm-panel">
          <header><div><strong>农场专用模型</strong><small>Independent model API</small></div><em>{config.apiKeyConfigured ? '密钥已保存在服务器' : '独立于聊天线路'}</em></header>
          <label><span>API 地址</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.siliconflow.cn/v1" /></label>
          <label><span>API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" placeholder={config.apiKeyConfigured ? '留空则继续使用已保存的 Key' : '只会保存到 Gateway'} /></label>
          <label><span>模型</span><input value={model} onChange={(event) => setModel(event.target.value)} list="es-farm-models" placeholder="选择便宜且支持工具调用的模型" /></label>
          <datalist id="es-farm-models">{models.map(item => <option value={item} key={item} />)}</datalist>
          <div className="es-farm-button-row">
            <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={loadModels}>{busy === 'models' ? '读取中…' : '读取模型'}</button>
            <button type="button" className="es-farm-secondary" disabled={Boolean(busy)} onClick={checkModel}>{busy === 'model' ? '测试中…' : '测试模型'}</button>
          </div>
        </section>

        <section className="es-farm-panel">
          <header><div><strong>自主经营</strong><small>Background play</small></div></header>
          <button type="button" className="es-farm-toggle-row" onClick={() => setAutonomousEnabled(value => !value)}>
            <span><b>主动醒来时可以玩农场</b><small>关闭 PWA 后也能由主动消息任务调用</small></span>
            <i className={autonomousEnabled ? 'on' : ''}><u /></i>
          </button>
          <button type="button" className="es-farm-link" onClick={onOpenAutomation}>主动联系的频率与时段仍在原设置里管理 ›</button>
        </section>

        <section className="es-farm-panel">
          <header><div><strong>允许的农场动作</strong><small>Tool permissions</small></div><em>{tools.length ? `${enabledToolNames.length} / ${tools.length}` : '连接后显示'}</em></header>
          {tools.length ? <div className="es-farm-tools">{tools.map(tool => (
            <label key={tool.name}>
              <input
                type="checkbox"
                checked={selectedTools.has(tool.name)}
                onChange={() => setEnabledToolNames(current => current.includes(tool.name) ? current.filter(name => name !== tool.name) : [...current, tool.name])}
              />
              <span><strong>{tool.name}</strong><small>{tool.description || '农场动作'}</small></span>
            </label>
          ))}</div> : <p className="es-farm-hint">先测试农场连接。首次连接时默认允许发现的全部动作，你可以在这里逐项关闭。</p>}
        </section>

        <button type="button" className="es-farm-save" disabled={Boolean(busy)} onClick={save}>{busy === 'save' ? '正在保存…' : '保存并接入无尽夏'}</button>
        <p className="es-farm-security">Agent Key 与农场模型 API Key 只保存在 Gateway；页面只读取“是否已配置”，不会回显密钥。</p>
      </div>
    </section>
  );
}
