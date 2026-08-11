import { useEffect, useMemo, useState } from 'react';
import {
  readHeartbeatInboxConfig,
  requestHeartbeatInboxSync,
  writeHeartbeatInboxConfig
} from '../../../app/heartbeat/heartbeatInboxSettings';
import type { Conversation, Persona } from '../../../types/domain';

type HeartbeatInboxSettingsCardProps = {
  personas: Persona[];
  conversations: Conversation[];
  lockedCollaboratorId?: string | null;
};

function isSecureEndpoint(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function HeartbeatInboxSettingsCard({
  personas,
  conversations,
  lockedCollaboratorId = null
}: HeartbeatInboxSettingsCardProps) {
  const storedConfig = useMemo(() => readHeartbeatInboxConfig(), []);
  const [enabled, setEnabled] = useState(storedConfig.enabled);
  const [endpoint, setEndpoint] = useState(storedConfig.endpoint);
  const [token, setToken] = useState(storedConfig.token);
  const [collaboratorId, setCollaboratorId] = useState(
    lockedCollaboratorId ?? storedConfig.collaboratorId ?? personas[0]?.id ?? ''
  );
  const [conversationId, setConversationId] = useState(storedConfig.conversationId ?? '');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (lockedCollaboratorId) setCollaboratorId(lockedCollaboratorId);
  }, [lockedCollaboratorId]);

  const conversationOptions = useMemo(
    () => conversations.filter((conversation) =>
      conversation.kind !== 'group'
      && conversation.collaboratorId === collaboratorId
      && (conversation.activeProjectId ?? null) === null
    ),
    [collaboratorId, conversations]
  );

  useEffect(() => {
    if (!conversationId) return;
    if (conversationOptions.some((conversation) => conversation.id === conversationId)) return;
    setConversationId('');
  }, [conversationId, conversationOptions]);

  const saveAndSync = () => {
    const targetCollaboratorId = lockedCollaboratorId ?? collaboratorId;
    if (enabled) {
      if (!isSecureEndpoint(endpoint)) {
        setStatus('收件箱地址必须是完整的 HTTPS 地址。');
        return;
      }
      if (!token.trim()) {
        setStatus('请填写收件箱密钥。');
        return;
      }
      if (!targetCollaboratorId) {
        setStatus('请选择接收心跳消息的协作者。');
        return;
      }
    }

    writeHeartbeatInboxConfig({
      enabled,
      endpoint,
      token,
      collaboratorId: targetCollaboratorId,
      conversationId: conversationId || null
    });
    requestHeartbeatInboxSync();
    setStatus(enabled ? '已保存，正在收取云端未读消息。' : '已保存，云端心跳收件箱已关闭。');
  };

  return (
    <section className="menu-section heartbeat-inbox-settings">
      <div className="menu-section-head heartbeat-inbox-settings__head">
        <div>
          <span className="menu-section-kicker">云端心跳收件箱</span>
          <p className="menu-section-note">打开北极星时，把云端等待中的消息按时间写进同一条对话。</p>
        </div>
        <button
          type="button"
          className={`ps-toggle-sw ${enabled ? 'ps-toggle-sw--on' : ''}`}
          aria-label="启用云端心跳收件箱"
          aria-pressed={enabled}
          onClick={() => setEnabled((current) => !current)}
        >
          <span className="ps-toggle-knob" />
        </button>
      </div>

      <div className="settings-form automation-settings-form heartbeat-inbox-settings__form">
        <label className="automation-field ps-field">
          <span className="ps-field-label">收件箱地址</span>
          <input
            className="ps-input"
            type="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://heartbeat.example.com/api/polaris/heartbeat"
          />
        </label>

        <label className="automation-field ps-field">
          <span className="ps-field-label">收件箱密钥</span>
          <input
            className="ps-input"
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="只保存在这台设备"
          />
        </label>

        {lockedCollaboratorId ? null : (
          <label className="automation-field ps-field">
            <span className="ps-field-label">消息属于谁</span>
            <select className="ps-input" value={collaboratorId} onChange={(event) => setCollaboratorId(event.target.value)}>
              <option value="">请选择协作者</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="automation-field ps-field">
          <span className="ps-field-label">写进哪条对话</span>
          <select className="ps-input" value={conversationId} onChange={(event) => setConversationId(event.target.value)}>
            <option value="">跟随最近一条普通对话</option>
            {conversationOptions.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title.trim() || '未命名对话'}
              </option>
            ))}
          </select>
        </label>

        <div className="automation-form-actions">
          <button type="button" className="mcp-btn primary" onClick={saveAndSync}>
            保存并立即同步
          </button>
        </div>
        {status ? <p className="heartbeat-inbox-settings__status" role="status">{status}</p> : null}
      </div>
    </section>
  );
}
