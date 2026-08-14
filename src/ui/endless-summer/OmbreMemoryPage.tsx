import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLOUD_BACKUP_CONFIG_CHANGED_EVENT } from '../../app/backup/cloudBackupSettings';
import {
  fetchOmbreBucket,
  fetchOmbreBuckets,
  fetchOmbreStatus,
  runOmbreBreathDebug,
  runOmbreBucketAction,
  searchOmbreBuckets,
  type OmbreBreathDebugResult,
  type OmbreBucket,
  type OmbreStatus
} from '../../app/ombre/ombreDashboardClient';
import { Icon } from '../Icon';

type OmbreFilter = {
  key: 'all' | 'dynamic' | 'permanent' | 'archived' | 'pinned';
  zh: string;
  en: string;
  type?: string;
  state?: string;
};

const FILTERS: readonly OmbreFilter[] = [
  { key: 'all', zh: '全部', en: 'All' },
  { key: 'dynamic', zh: '动态', en: 'Dynamic', type: 'dynamic' },
  { key: 'permanent', zh: '永久', en: 'Permanent', type: 'permanent' },
  { key: 'archived', zh: '已归档', en: 'Archived', state: 'archived' },
  { key: 'pinned', zh: '已钉选', en: 'Pinned', state: 'pinned' }
];

function formatDate(value: string | null, includeYear = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    ...(includeYear ? { year: 'numeric' as const } : {}),
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function typeLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === 'permanent') return '永久 · Permanent';
  if (normalized === 'archived' || normalized === 'archive') return '已归档 · Archived';
  if (normalized === 'feel') return '感受 · Feel';
  if (normalized === 'plan') return '计划 · Plan';
  if (normalized === 'letter') return '信件 · Letter';
  return '动态 · Dynamic';
}

function Importance({ value }: { value: number }) {
  const count = Math.max(0, Math.min(10, Math.round(value)));
  return <span className="es-ombre-importance" aria-label={`重要度 ${count}/10`}>{'●'.repeat(count)}{'○'.repeat(10 - count)}</span>;
}

function OmbreDetail({ memory, loading, onClose, onChanged }: {
  memory: OmbreBucket | null;
  loading: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busyAction, setBusyAction] = useState('');
  if (!memory) return null;

  const act = async (action: 'pin' | 'resolve' | 'archive' | 'forget' | 'anchor') => {
    if (action === 'archive' && !window.confirm('将这条记忆移入 OB 档案，确定吗？')) return;
    setBusyAction(action);
    try {
      await runOmbreBucketAction(memory.id, action);
      onChanged();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="es-ombre-sheet-layer" role="presentation">
      <button type="button" className="es-ombre-sheet-backdrop" onClick={onClose} aria-label="关闭记忆详情" />
      <section className="es-ombre-sheet" role="dialog" aria-modal="true" aria-label="记忆详情">
        <button type="button" className="es-ombre-sheet-handle" onClick={onClose} aria-label="关闭" />
        <div className="es-ombre-sheet-scroll">
          <h2>{memory.name || '未命名记忆'}</h2>
          <p className="es-ombre-sheet-type">{typeLabel(memory.type)}</p>
          {memory.whyRemembered ? <blockquote>{memory.whyRemembered}</blockquote> : null}
          <div className="es-ombre-sheet-content">{memory.content || memory.contentPreview || '（空）'}</div>
          {loading ? <p className="es-ombre-detail-loading">正在读取完整内容…<small>Opening memory…</small></p> : null}
          <dl>
            <div><dt>被想起<small>Activation</small></dt><dd>{memory.activationCount} 次</dd></div>
            <div><dt>创建于<small>Created</small></dt><dd>{formatDate(memory.createdAt, true)}</dd></div>
            <div><dt>最近激活<small>Last active</small></dt><dd>{formatDate(memory.lastActiveAt, true)}</dd></div>
            <div><dt>重要度<small>Importance</small></dt><dd><Importance value={memory.importance} /></dd></div>
            {memory.valence !== null ? <div><dt>情绪效价<small>Valence</small></dt><dd>{memory.valence}</dd></div> : null}
            {memory.arousal !== null ? <div><dt>唤醒度<small>Arousal</small></dt><dd>{memory.arousal}</dd></div> : null}
          </dl>
          {[...memory.domains, ...memory.tags].length ? (
            <div className="es-ombre-tags">{[...memory.domains, ...memory.tags].map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>
          ) : null}
          <div className="es-ombre-detail-actions">
            <button type="button" onClick={() => void act('pin')} disabled={Boolean(busyAction)}>{memory.pinned ? '取消钉选' : '钉选'}<small>{memory.pinned ? 'Unpin' : 'Pin'}</small></button>
            <button type="button" onClick={() => void act('resolve')} disabled={Boolean(busyAction)}>{memory.resolved ? '恢复未解决' : '标为已解决'}<small>{memory.resolved ? 'Reopen' : 'Resolve'}</small></button>
            <button type="button" onClick={() => void act('forget')} disabled={Boolean(busyAction)}>{memory.dontSurface ? '恢复浮现' : '暂不浮现'}<small>{memory.dontSurface ? 'Surface' : 'Rest'}</small></button>
            <button type="button" onClick={() => void act('archive')} disabled={Boolean(busyAction)}>移入档案<small>Archive</small></button>
          </div>
          <button type="button" className="es-ombre-copy-id" onClick={() => void navigator.clipboard?.writeText(memory.id)}>ID: {memory.id} · 点击复制</button>
        </div>
      </section>
    </div>
  );
}

function BreathLab() {
  const [query, setQuery] = useState('');
  const [valence, setValence] = useState('');
  const [arousal, setArousal] = useState('');
  const [result, setResult] = useState<OmbreBreathDebugResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      setResult(await runOmbreBreathDebug(query.trim(), { valence, arousal }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '调试失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="es-breath-lab">
      <label><span>模拟一句话<small>Simulate a message</small></span><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="他现在会想起哪些记忆？" /></label>
      <div className="es-breath-coordinates">
        <label><span>情绪效价<small>Valence</small></span><input type="number" min="-1" max="1" step="0.1" value={valence} onChange={(event) => setValence(event.target.value)} placeholder="可选" /></label>
        <label><span>唤醒度<small>Arousal</small></span><input type="number" min="0" max="1" step="0.1" value={arousal} onChange={(event) => setArousal(event.target.value)} placeholder="可选" /></label>
      </div>
      <button type="button" className="es-breath-run" onClick={() => void run()} disabled={busy || !query.trim()}>{busy ? '正在运行…' : '运行呼吸'}<small>Run Breath</small></button>
      {error ? <p className="es-ombre-error">{error}</p> : null}
      {result ? (
        <div className="es-breath-results">
          <p>候选 {result.totalCandidates ?? result.results?.length ?? 0} 条 · 通过 {result.passedCount ?? result.results?.filter(item => item.passed).length ?? 0} 条</p>
          {(result.results ?? []).map((item, index) => {
            const score = typeof item.finalScore === 'number' ? item.finalScore : 0;
            return (
              <article key={item.id || `${item.name}-${index}`}>
                <header><strong>{item.name || '未命名记忆'}</strong><span>{score.toFixed(3)}</span></header>
                <div className="es-breath-score"><i style={{ width: `${Math.max(0, Math.min(100, score * 100))}%` }} /></div>
                <small>{item.passed ? '通过阈值 · Passed' : '未通过 · Filtered'}</small>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function OmbreMemoryPage({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<'memories' | 'breath'>('memories');
  const [status, setStatus] = useState<OmbreStatus | null>(null);
  const [items, setItems] = useState<OmbreBucket[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<OmbreBucket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const selectedFilter = FILTERS.find(item => item.key === filter) ?? FILTERS[0];
      const [nextStatus, list] = await Promise.all([
        fetchOmbreStatus(),
        debouncedSearch
          ? searchOmbreBuckets(debouncedSearch)
          : fetchOmbreBuckets({ type: selectedFilter.type, state: selectedFilter.state })
      ]);
      setStatus(nextStatus);
      setItems(list.items);
    } catch (caught) {
      setStatus(null);
      setError(caught instanceof Error ? caught.message : 'Ombre Brain 暂时没有回应');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    window.addEventListener(CLOUD_BACKUP_CONFIG_CHANGED_EVENT, load);
    return () => window.removeEventListener(CLOUD_BACKUP_CONFIG_CHANGED_EVENT, load);
  }, [load]);

  const openDetail = async (item: OmbreBucket) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      setSelected(await fetchOmbreBucket(item.id));
    } catch {
      setSelected(item);
    } finally {
      setDetailLoading(false);
    }
  };
  const total = useMemo(() => status?.total ?? items.length, [items.length, status?.total]);

  return (
    <section className="es-collection-page es-ombre-page" aria-label="Ombre Brain 长期记忆">
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label="返回记忆">‹</button>
        <div><h1>长期记忆</h1><p>Ombre Brain</p></div>
        <span className={`es-ombre-status-dot ${status?.available ? 'online' : ''}`} aria-label={status?.available ? '在线' : '离线'} />
      </header>
      <nav className="es-ombre-tabs" aria-label="Ombre Brain 页面">
        <button type="button" className={view === 'memories' ? 'active' : ''} onClick={() => setView('memories')}>记忆<small>Memories</small></button>
        <button type="button" className={view === 'breath' ? 'active' : ''} onClick={() => setView('breath')}>呼吸实验室<small>Breath Lab</small></button>
      </nav>
      {view === 'breath' ? <BreathLab /> : (
        <div className="es-ombre-body">
          <p className="es-ombre-status-copy"><i className={status?.available ? 'online' : ''} />{status?.available ? `已连接 · ${total} 条记忆` : '尚未连接'}<small>{status?.available ? `Connected · ${total} memories` : 'Not connected'}</small></p>
          <label className="es-ombre-search"><Icon name="search" size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索记忆…" /><small>Search memories</small></label>
          <div className="es-ombre-filters">{FILTERS.map(item => <button type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)} key={item.key}><span>{item.zh}</span><small>{item.en}</small></button>)}</div>
          {loading ? <p className="es-ombre-loading">正在读取记忆…<small>Loading memories…</small></p> : null}
          {error && !loading ? <div className="es-ombre-offline"><strong>Ombre 暂时睡着了</strong><span>{error}</span><small>Your memories are still safe.</small><button type="button" onClick={() => void load()}>重试 · Retry</button></div> : null}
          {!loading && !error && items.length === 0 ? <p className="es-ombre-empty">还没有找到记忆<small>No memories found.</small></p> : null}
          <div className="es-ombre-list">{!loading && !error ? items.map(memory => (
            <button type="button" className="es-ombre-memory-card" onClick={() => void openDetail(memory)} key={memory.id}>
              <header><span>{typeLabel(memory.type)}</span><time>{formatDate(memory.createdAt)}</time></header>
              <strong>{memory.name}</strong>
              <p>{memory.contentPreview || '（空）'}</p>
              <footer><Importance value={memory.importance} /><span>{[...memory.domains, ...memory.tags].slice(0, 3).map(tag => <i key={tag}>{tag}</i>)}</span></footer>
              {memory.pinned || memory.resolved || memory.dontSurface ? <div className="es-ombre-badges">{memory.pinned ? <em>Pin</em> : null}{memory.resolved ? <em>Resolved</em> : null}{memory.dontSurface ? <em>Resting</em> : null}</div> : null}
            </button>
          )) : null}</div>
        </div>
      )}
      <OmbreDetail memory={selected} loading={detailLoading} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); void load(); }} />
    </section>
  );
}
