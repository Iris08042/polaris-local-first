import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealthSnapshot, type HealthMetric, type HealthSnapshot } from '../../app/health/healthClient';
import { Icon } from '../Icon';

const SHORTCUT_NAME = '同步身体近况';
const SYNC_BASELINE_KEY = 'endless-summer-health-sync-baseline';

type MetricRow = {
  key: string;
  title: string;
  icon: 'heart' | 'zap' | 'sun';
};

const METRIC_ROWS: MetricRow[] = [
  { key: 'sleep_analysis', title: '睡眠', icon: 'sun' },
  { key: 'heart_rate', title: '心率', icon: 'heart' },
  { key: 'heart_rate_variability', title: 'HRV', icon: 'zap' },
  { key: 'resting_heart_rate', title: '静息心率', icon: 'heart' },
  { key: 'walking_heart_rate_average', title: '步行平均心率', icon: 'heart' },
  { key: 'step_count', title: '步数', icon: 'sun' }
];

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function formatDuration(hours: number) {
  const minutes = Math.round(hours * 60);
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${wholeHours ? `${wholeHours} 小时` : ''}${remainder ? ` ${remainder} 分钟` : ''}`.trim() || '0 分钟';
}

function metricMainValue(key: string, metric: HealthMetric | undefined) {
  if (!metric || metric.available === false || !metric.value) return '暂无数据';
  const value = metric.value;
  if (key === 'sleep_analysis') {
    const total = readNumber(value.totalSleep) ?? readNumber(value.asleep);
    return total === null ? '暂无睡眠时长' : formatDuration(total);
  }
  if (key === 'heart_rate') {
    const average = readNumber(value.Avg) ?? readNumber(value.qty);
    return average === null ? '暂无数据' : `${formatNumber(average)} ${metric.units || 'bpm'}`;
  }
  const quantity = readNumber(value.qty) ?? readNumber(value.value);
  return quantity === null ? '暂无数据' : `${formatNumber(quantity)}${metric.units ? ` ${metric.units}` : ''}`;
}

function sleepDetail(metric: HealthMetric | undefined, scoreMetric: HealthMetric | undefined) {
  const value = metric?.value;
  if (!value) return '';
  const stages = [
    ['核心', readNumber(value.core)],
    ['深睡', readNumber(value.deep)],
    ['REM', readNumber(value.rem)]
  ].filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([label, hours]) => `${label} ${formatDuration(hours)}`);
  const score = scoreMetric?.value
    ? readNumber(scoreMetric.value.qty) ?? readNumber(scoreMetric.value.value)
    : null;
  return [...(score === null ? [] : [`睡眠评分 ${formatNumber(score)}`]), ...stages].join(' · ');
}

function formatDateTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function sourceText(metric: HealthMetric | undefined) {
  const source = metric?.value?.source;
  return typeof source === 'string' && source.trim() ? ` · ${source.trim()}` : '';
}

export function HealthPage({ onBack, verifySync }: { onBack: () => void; verifySync: boolean }) {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchHealthSnapshot();
      setSnapshot(next);
      setError('');
      return next;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '健康数据读取失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const handleFocus = () => { void load(); };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (!verifySync) return;
    const baseline = Number(window.localStorage.getItem(SYNC_BASELINE_KEY) || 0);
    let attempts = 0;
    setMessage('正在确认服务器有没有收到新数据…');
    const check = async () => {
      attempts += 1;
      const next = await load();
      if (next?.lastUploadAt && next.lastUploadAt > baseline) {
        setMessage('刚刚同步成功，下面是服务器收到的最新数据。');
        window.localStorage.removeItem(SYNC_BASELINE_KEY);
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = null;
      } else if (attempts >= 15) {
        setMessage('暂时没有收到新上传。请检查 HAE 自动化日志和网络后再试。');
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    void check();
    pollRef.current = window.setInterval(() => { void check(); }, 2_000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [load, verifySync]);

  const runShortcut = () => {
    window.localStorage.setItem(SYNC_BASELINE_KEY, String(snapshot?.lastUploadAt || 0));
    setMessage(`正在打开快捷指令“${SHORTCUT_NAME}”…`);
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
  };

  const lastUpload = snapshot?.lastUploadAt || null;
  const ready = Boolean(lastUpload);
  return (
    <section className="es-health-page">
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label="返回功能">‹</button>
        <div><h1>身体近况</h1><p>Apple Health 最近同步到服务器的数据</p></div>
        <i className={`es-health-status ${ready ? 'ready' : ''}`} aria-label={ready ? '已有同步数据' : '等待首次同步'} />
      </header>
      <div className="es-health-scroll">
        <article className="es-health-overview">
          <span className="es-health-overview-icon"><Icon name="heart" size={30} /></span>
          <div>
            <strong>{ready ? '健康数据已接入' : '等待首次同步'}</strong>
            <small>{ready ? `服务器最近收到：${formatDateTime(lastUpload)}` : '完成 HAE 与快捷指令设置后，这里会出现数据'}</small>
          </div>
          <button type="button" onClick={runShortcut}>立即同步一次</button>
          <p>会先明确打开 Health Auto Export，再运行上传自动化；即使 HAE 被划走，也能重新启动。是否成功以服务器收到新数据为准。</p>
        </article>

        {message ? <p className="es-health-message">{message}</p> : null}
        {error ? <p className="es-health-message error">{error}</p> : null}
        {loading && !snapshot ? <p className="es-health-loading">正在读取身体近况…</p> : null}

        <div className="es-health-metrics">
          {METRIC_ROWS.map((row) => {
            const metric = snapshot?.metrics[row.key];
            const detail = row.key === 'sleep_analysis'
              ? sleepDetail(metric, snapshot?.metrics.sleep_score)
              : '';
            return (
              <article className="es-health-metric" key={row.key}>
                <span><Icon name={row.icon} size={24} /></span>
                <div>
                  <small>{row.title}</small>
                  <strong>{metricMainValue(row.key, metric)}</strong>
                  {detail ? <em>{detail}</em> : null}
                  <p>采样 {formatDateTime(metric?.sampleAt)}{sourceText(metric)}</p>
                </div>
              </article>
            );
          })}
        </div>

        <details className="es-health-setup">
          <summary>首次同步设置</summary>
          <ol>
            <li>在 HAE 建好上传到无尽夏的 REST API 自动化。</li>
            <li>在快捷指令新建“{SHORTCUT_NAME}”。</li>
            <li>依次放入：打开 HAE、等待 1 秒、运行 HAE 自动化、等待上传、打开无尽夏身体近况页。</li>
          </ol>
          <p>快捷指令最后打开：<code>https://polaris.yichen888.top/?open=health&amp;healthSync=1</code></p>
        </details>
      </div>
    </section>
  );
}
