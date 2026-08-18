import { useEffect } from 'react';
import {
  HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT,
  readHeartbeatInboxConfig
} from '../heartbeat/heartbeatInboxSettings';
import { useRuntimeStore } from '../../stores/runtimeStore';
import {
  buildManagedScheduledMessageMcpServer,
  mergeManagedScheduledMessageMcpServer
} from './managedScheduledMessageMcp';

export function useManagedScheduledMessageMcp(enabled: boolean) {
  const hydrated = useRuntimeStore(state => state.hydrated);

  useEffect(() => {
    if (!enabled || !hydrated || typeof window === 'undefined') return;
    let cancelled = false;

    const syncManagedServer = async () => {
      const config = readHeartbeatInboxConfig();
      const runtime = useRuntimeStore.getState();
      const managed = config.endpoint && config.token
        ? buildManagedScheduledMessageMcpServer(config.endpoint, config.token)
        : null;
      const nextServers = mergeManagedScheduledMessageMcpServer(runtime.mcpServers, managed);
      if (JSON.stringify(nextServers) === JSON.stringify(runtime.mcpServers)) return;
      runtime.setMcpServers(nextServers);
      if (!cancelled) await useRuntimeStore.getState().persistToDb();
    };

    void syncManagedServer();
    const handleConfigChanged = () => { void syncManagedServer(); };
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, handleConfigChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, handleConfigChanged);
    };
  }, [enabled, hydrated]);
}
