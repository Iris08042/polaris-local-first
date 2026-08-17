import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchHeartbeatPolicy,
  notifyHeartbeatPolicyChanged,
  saveHeartbeatPolicy,
  type HeartbeatPolicy,
  type HeartbeatPolicySnapshot,
  type HeartbeatProfile,
  type HeartbeatSchedule
} from '../../../app/heartbeat/heartbeatPolicyClient';
import { HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT } from '../../../app/heartbeat/heartbeatInboxSettings';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const SOURCE_LABELS = { override: '临时模式', once: '单次时段', recurring: '循环时段', default: '默认设置' };

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function localDateTime(iso: string | null) {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function minutes(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

export function HeartbeatPolicyPanel() {
  const [snapshot, setSnapshot] = useState<HeartbeatPolicySnapshot | null>(null);
  const [policy, setPolicy] = useState<HeartbeatPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await fetchHeartbeatPolicy();
      setSnapshot(next);
      setPolicy(next.policy);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取心跳策略。');
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

  const profilesById = useMemo(
    () => new Map(policy?.profiles.map((profile) => [profile.id, profile]) ?? []),
    [policy?.profiles]
  );

  function patchProfile(id: string, patch: Partial<HeartbeatProfile>) {
    setPolicy((current) => current && ({
      ...current,
      profiles: current.profiles.map((profile) => profile.id === id ? { ...profile, ...patch } : profile)
    }));
  }

  function patchSchedule(id: string, patch: Partial<HeartbeatSchedule>) {
    setPolicy((current) => current && ({
      ...current,
      schedules: current.schedules.map((schedule) => schedule.id === id ? { ...schedule, ...patch } as HeartbeatSchedule : schedule)
    }));
  }

  async function save() {
    if (!policy) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await saveHeartbeatPolicy(policy);
      setSnapshot(next);
      setPolicy(next.policy);
      notifyHeartbeatPolicyChanged();
      setNotice('已保存，云端心跳会立即按新策略运行。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !policy) return <div className="heartbeat-policy-state">正在读取云端心跳策略…</div>;
  if (!policy) {
    return <div className="heartbeat-policy-state heartbeat-policy-state--error">{error || '还没有可用的心跳策略。'}</div>;
  }

  const activeProfile = profilesById.get(snapshot?.active.profileId || '');
  const customCount = policy.profiles.filter((profile) => !profile.builtin).length;

  return (
    <section className="heartbeat-policy">
      <header className="heartbeat-policy__header">
        <div>
          <h3>主动联系策略</h3>
          <p>档位和时段保存在云端；修改后无需登录服务器，也无需重启。</p>
        </div>
        <button className="mcp-btn" type="button" onClick={() => void load()} disabled={loading}>刷新</button>
      </header>

      <div className="heartbeat-policy__active">
        <span>当前生效</span>
        <strong>{policy.enabled
          ? `${activeProfile?.name || snapshot?.active.profileName || '未知'} · ${snapshot?.active.allowContact === false ? '免打扰' : '可打扰'}`
          : '主动消息已暂停'}</strong>
        <small>{policy.enabled ? snapshot ? SOURCE_LABELS[snapshot.active.source] : '尚未读取' : '仍会收取已有未读消息'}</small>
      </div>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>主动消息总开关</h4><p>关闭后不再生成新消息；云端已有的未读消息仍会正常收取。</p></div>
          <label className="heartbeat-policy__switch"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({
            ...policy,
            enabled: event.target.checked
          })} /><span /></label>
        </div>
      </div>

      <div className="heartbeat-policy__section">
        <h4>默认设置</h4>
        <label>默认频率<select className="ps-input" value={policy.defaultProfileId} onChange={(event) => setPolicy({ ...policy, defaultProfileId: event.target.value })}>
          {policy.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select></label>
        <div className="heartbeat-policy__section-head">
          <div><h4>允许主动联系</h4><p>关闭后仍按默认频率唤醒，但不会主动说话或发送 Bark。</p></div>
          <label className="heartbeat-policy__switch"><input type="checkbox" checked={policy.defaultAllowContact} onChange={(event) => setPolicy({ ...policy, defaultAllowContact: event.target.checked })} /><span /></label>
        </div>
      </div>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>临时模式</h4><p>优先级最高；可设截止时间，也可一直保持到手动关闭。</p></div>
          <label className="heartbeat-policy__switch"><input type="checkbox" checked={Boolean(policy.override)} onChange={(event) => setPolicy({
            ...policy,
            override: event.target.checked ? { profileId: policy.defaultProfileId, allowContact: policy.defaultAllowContact, until: null } : null
          })} /><span /></label>
        </div>
        {policy.override && <>
          <div className="heartbeat-policy__row">
            <label>临时频率<select className="ps-input" value={policy.override.profileId} onChange={(event) => setPolicy({ ...policy, override: { ...policy.override!, profileId: event.target.value } })}>
              {policy.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select></label>
            <label>截止时间（留空为长期）<input className="ps-input" type="datetime-local" value={localDateTime(policy.override.until)} onChange={(event) => setPolicy({ ...policy, override: { ...policy.override!, until: event.target.value ? isoDateTime(event.target.value) : null } })} /></label>
          </div>
          <div className="heartbeat-policy__section-head">
            <div><h4>允许主动联系</h4><p>此状态只在本次临时模式期间生效。</p></div>
            <label className="heartbeat-policy__switch"><input type="checkbox" checked={policy.override.allowContact} onChange={(event) => setPolicy({ ...policy, override: { ...policy.override!, allowContact: event.target.checked } })} /><span /></label>
          </div>
        </>}
      </div>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>档位设置</h4><p>三列依次是：多久没聊天后考虑联系、未回复时再次联系的冷静期、选择沉默后多久再考虑。</p></div>
          <button className="mcp-btn" type="button" onClick={() => setPolicy({
            ...policy,
            profiles: [...policy.profiles, { id: newId('custom'), name: `自定义${customCount + 1}`, builtin: false, userIdleMinutes: 60, sendCooldownMinutes: 120, reconsiderMinutes: 20 }]
          })}>＋ 自定义</button>
        </div>
        <div className="heartbeat-policy__profiles">
          {policy.profiles.map((profile) => <article className="heartbeat-policy__profile" key={profile.id}>
            <div className="heartbeat-policy__profile-head">
              <input className="ps-input" value={profile.name} onChange={(event) => patchProfile(profile.id, { name: event.target.value })} />
              {!profile.builtin && <button type="button" className="heartbeat-policy__delete" onClick={() => setPolicy({
                ...policy,
                defaultProfileId: policy.defaultProfileId === profile.id ? 'normal' : policy.defaultProfileId,
                profiles: policy.profiles.filter((item) => item.id !== profile.id),
                schedules: policy.schedules.filter((item) => item.profileId !== profile.id),
                override: policy.override?.profileId === profile.id ? null : policy.override
              })}>删除</button>}
            </div>
            {profile.silent ? <p className="heartbeat-policy__silent">此档位完全静默，不进行模型调用。</p> : <div className="heartbeat-policy__thresholds">
              <label>首次考虑（分钟）<input className="ps-input" type="number" min="1" value={profile.userIdleMinutes ?? 1} onChange={(event) => patchProfile(profile.id, { userIdleMinutes: minutes(event.target.value) })} /></label>
              <label>再次联系（分钟）<input className="ps-input" type="number" min="1" value={profile.sendCooldownMinutes ?? 1} onChange={(event) => patchProfile(profile.id, { sendCooldownMinutes: minutes(event.target.value) })} /></label>
              <label>重新考虑（分钟）<input className="ps-input" type="number" min="1" value={profile.reconsiderMinutes ?? 1} onChange={(event) => patchProfile(profile.id, { reconsiderMinutes: minutes(event.target.value) })} /></label>
            </div>}
          </article>)}
        </div>
      </div>

      <div className="heartbeat-policy__section">
        <div className="heartbeat-policy__section-head">
          <div><h4>时段方案</h4><p>单次方案优先于循环方案；循环方案支持跨午夜。</p></div>
          <div className="heartbeat-policy__actions">
            <button className="mcp-btn" type="button" onClick={() => setPolicy({ ...policy, schedules: [...policy.schedules, { id: newId('recurring'), name: '新循环时段', enabled: true, type: 'recurring', profileId: policy.defaultProfileId, allowContact: policy.defaultAllowContact, days: [1, 2, 3, 4, 5, 6, 7], start: '09:00', end: '18:00' }] })}>＋ 循环</button>
            <button className="mcp-btn" type="button" onClick={() => {
              const start = new Date(Date.now() + 60 * 60_000);
              const end = new Date(start.getTime() + 2 * 60 * 60_000);
              setPolicy({ ...policy, schedules: [...policy.schedules, { id: newId('once'), name: '新单次时段', enabled: true, type: 'once', profileId: policy.defaultProfileId, allowContact: policy.defaultAllowContact, startAt: start.toISOString(), endAt: end.toISOString() }] });
            }}>＋ 单次</button>
          </div>
        </div>
        {policy.schedules.length === 0 && <p className="heartbeat-policy__empty">还没有时段方案，全天使用默认档位。</p>}
        <div className="heartbeat-policy__schedules">
          {policy.schedules.map((schedule) => <article className="heartbeat-policy__schedule" key={schedule.id}>
            <div className="heartbeat-policy__schedule-head">
              <label className="heartbeat-policy__switch"><input type="checkbox" checked={schedule.enabled} onChange={(event) => patchSchedule(schedule.id, { enabled: event.target.checked })} /><span /></label>
              <input className="ps-input" value={schedule.name} onChange={(event) => patchSchedule(schedule.id, { name: event.target.value })} />
              <select className="ps-input" value={schedule.profileId} onChange={(event) => patchSchedule(schedule.id, { profileId: event.target.value })}>{policy.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
              <button type="button" className="heartbeat-policy__delete" onClick={() => setPolicy({ ...policy, schedules: policy.schedules.filter((item) => item.id !== schedule.id) })}>删除</button>
            </div>
            <div className="heartbeat-policy__section-head">
              <div><h4>允许主动联系</h4><p>关闭后此时段仍按所选频率唤醒，但不会主动说话或发送 Bark。</p></div>
              <label className="heartbeat-policy__switch"><input type="checkbox" checked={schedule.allowContact} onChange={(event) => patchSchedule(schedule.id, { allowContact: event.target.checked })} /><span /></label>
            </div>
            {schedule.type === 'recurring' ? <>
              <div className="heartbeat-policy__days">{WEEKDAYS.map((day, index) => {
                const value = index + 1;
                const selected = schedule.days.includes(value);
                return <button type="button" className={selected ? 'is-active' : ''} key={value} onClick={() => patchSchedule(schedule.id, { days: selected ? schedule.days.filter((item) => item !== value) : [...schedule.days, value].sort() })}>{day}</button>;
              })}</div>
              <div className="heartbeat-policy__row"><label>开始<input className="ps-input" type="time" value={schedule.start} onChange={(event) => patchSchedule(schedule.id, { start: event.target.value })} /></label><label>结束<input className="ps-input" type="time" value={schedule.end} onChange={(event) => patchSchedule(schedule.id, { end: event.target.value })} /></label></div>
            </> : <div className="heartbeat-policy__row"><label>开始<input className="ps-input" type="datetime-local" value={localDateTime(schedule.startAt)} onChange={(event) => patchSchedule(schedule.id, { startAt: isoDateTime(event.target.value) })} /></label><label>结束<input className="ps-input" type="datetime-local" value={localDateTime(schedule.endAt)} onChange={(event) => patchSchedule(schedule.id, { endAt: isoDateTime(event.target.value) })} /></label></div>}
          </article>)}
        </div>
      </div>

      {(error || notice) && <p className={`heartbeat-policy-state${error ? ' heartbeat-policy-state--error' : ''}`}>{error || notice}</p>}
      <button className="heartbeat-policy__save" type="button" onClick={() => void save()} disabled={saving}>{saving ? '正在保存…' : '保存全部设置'}</button>
    </section>
  );
}
