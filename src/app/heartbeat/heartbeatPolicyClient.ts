import { readHeartbeatInboxConfig } from './heartbeatInboxSettings';

export const HEARTBEAT_POLICY_CHANGED_EVENT = 'polaris:heartbeat-policy-changed';

export type HeartbeatProfile = {
  id: string;
  name: string;
  builtin: boolean;
  silent?: boolean;
  userIdleMinutes?: number;
  sendCooldownMinutes?: number;
  reconsiderMinutes?: number;
};

export type HeartbeatRecurringSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  type: 'recurring';
  profileId: string;
  allowContact: boolean;
  days: number[];
  start: string;
  end: string;
};

export type HeartbeatOneTimeSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  type: 'once';
  profileId: string;
  allowContact: boolean;
  startAt: string;
  endAt: string;
};

export type HeartbeatSchedule = HeartbeatRecurringSchedule | HeartbeatOneTimeSchedule;

export type HeartbeatPolicy = {
  version: 2;
  enabled: boolean;
  defaultProfileId: string;
  defaultAllowContact: boolean;
  profiles: HeartbeatProfile[];
  schedules: HeartbeatSchedule[];
  override: { profileId: string; allowContact: boolean; until: string | null } | null;
};

export type HeartbeatPolicySnapshot = {
  policy: HeartbeatPolicy;
  active: {
    profileId: string;
    profileName: string;
    allowContact: boolean;
    source: 'override' | 'once' | 'recurring' | 'default';
    scheduleId?: string | null;
    scheduleName?: string | null;
  };
  state: Record<string, unknown>;
  serverTime: string;
  timeZone: string;
};

function connection() {
  const config = readHeartbeatInboxConfig();
  if (!config.endpoint || !config.token) {
    throw new Error('请先填写并保存云端心跳收件箱地址和密钥。');
  }
  return config;
}

export function heartbeatPolicyEndpoint(inboxEndpoint: string) {
  return `${inboxEndpoint.replace(/\/inbox$/, '')}/policy`;
}

async function requestPolicy(method: 'GET' | 'PUT', policy?: HeartbeatPolicy) {
  const config = connection();
  const response = await fetch(heartbeatPolicyEndpoint(config.endpoint), {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: policy ? JSON.stringify({ policy }) : undefined
  });
  const body = await response.json().catch(() => null) as HeartbeatPolicySnapshot | { error?: string; message?: string } | null;
  if (!response.ok) {
    const problem = body && 'error' in body ? body.error || body.message : null;
    throw new Error(problem || `心跳策略请求失败（${response.status}）`);
  }
  return body as HeartbeatPolicySnapshot;
}

export function fetchHeartbeatPolicy() {
  return requestPolicy('GET');
}

export function saveHeartbeatPolicy(policy: HeartbeatPolicy) {
  return requestPolicy('PUT', policy);
}

export function notifyHeartbeatPolicyChanged() {
  window.dispatchEvent(new Event(HEARTBEAT_POLICY_CHANGED_EVENT));
}
