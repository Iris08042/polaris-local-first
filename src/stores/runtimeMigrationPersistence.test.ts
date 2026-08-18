import { afterEach, describe, expect, it } from 'vitest';
import {
  ASSET_BINARY_STORE,
  ASSET_META_STORE,
  ASSET_PREVIEW_STORE,
  KV_STORE,
  kvGet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistenceBackend
} from '../infrastructure/persistence';
import {
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  getRuntimeDomainMetaLocalDataRef,
  getRuntimeObjectLocalDataRef,
  type CommitPointerRow,
  type RuntimeDomainMetaRow,
  type LocalDataCompleteRow,
  type RuntimeObjectRow
} from '../engines/localData';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from './runtimeStoreToolbox';
import { DEFAULT_WEBDAV_CONFIG } from './runtimeStoreWebDav';
import { DEFAULT_WEB_SEARCH_CONFIG } from './runtimeStoreSearch';
import { DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS } from './runtimeStoreConversationSummary';
import { DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS } from './runtimeStoreMemoryRetrieval';
import { DEFAULT_IMAGE_GENERATION_SETTINGS } from './runtimeStoreImageGeneration';
import { DEFAULT_IMAGE_UNDERSTANDING_SETTINGS } from './runtimeStoreImageUnderstanding';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from './runtimeStoreVoiceGeneration';
import { DEFAULT_COMPANION_HOST_STATE } from './runtimeStoreCompanion';
import { commitRuntimeRowsMigrationFromCurrentPersistence } from './runtimeMigrationPersistence';
import type { RuntimePayload } from './runtimeStorePersistence';

function createMemoryPersistenceBackend(args: {
  kv?: PersistedDbEntry[];
} = {}): PersistenceBackend {
  const stores = new Map<string, Map<string, unknown>>([
    [KV_STORE, new Map((args.kv ?? []).map((entry) => [entry.key, entry.value]))],
    [ASSET_BINARY_STORE, new Map()],
    [ASSET_META_STORE, new Map()],
    [ASSET_PREVIEW_STORE, new Map()]
  ]);
  const getStore = (storeName: string) => {
    let store = stores.get(storeName);
    if (!store) {
      store = new Map();
      stores.set(storeName, store);
    }
    return store;
  };

  return {
    async dbStoreGet<T>(storeName: string, key: string) {
      return (getStore(storeName).get(key) as T | undefined) ?? null;
    },
    async dbStoreSet(storeName: string, key: string, value: unknown) {
      getStore(storeName).set(key, value);
    },
    async dbStoreDelete(storeName: string, key: string) {
      getStore(storeName).delete(key);
    },
    async dbStoreEntries<T>(storeName: string) {
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({ key, value: value as T }));
    },
    async dbStoreClear(storeName: string) {
      getStore(storeName).clear();
    },
    async kvApplyMutations(mutations) {
      const kv = getStore(KV_STORE);
      mutations.forEach((mutation) => {
        if (mutation.type === 'set') kv.set(mutation.key, mutation.value);
        else kv.delete(mutation.key);
      });
    },
    async kvReplaceAll(entries) {
      stores.set(KV_STORE, new Map(entries.map((entry) => [entry.key, entry.value])));
    }
  };
}

function runtimePayload(): RuntimePayload {
  return {
    providers: [{
      id: 'provider-1',
      name: 'Provider',
      protocol: 'openai-completions',
      baseUrl: 'https://api.example.com',
      path: '/v1/chat/completions',
      apiKey: 'secret-key',
      model: 'model-a',
      capabilities: {
        images: false,
        streaming: true,
        thinking: false
      }
    }],
    activeProviderId: 'provider-1',
    webdav: { ...DEFAULT_WEBDAV_CONFIG },
    search: { ...DEFAULT_WEB_SEARCH_CONFIG },
    conversationSummaryModel: { ...DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS },
    memoryVectorRetrieval: { ...DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS },
    imageGeneration: { ...DEFAULT_IMAGE_GENERATION_SETTINGS },
    imageUnderstanding: { ...DEFAULT_IMAGE_UNDERSTANDING_SETTINGS },
    voiceGeneration: { ...DEFAULT_VOICE_GENERATION_SETTINGS },
    toolPromptPreferences: { ...DEFAULT_RUNTIME_TOOLBOX_STATE.toolPromptPreferences },
    taskModeEnabled: false,
    mcpServers: [{
      id: 'mcp-1',
      handle: 'mcp_one',
      name: 'MCP One',
      description: '',
      transport: 'streamable-http',
      url: 'https://mcp.example.com',
      headers: [],
      isActive: true
    }],
    mcpToolTimeoutSeconds: 45,
    companionHost: { ...DEFAULT_COMPANION_HOST_STATE },
    companionConnections: [{
      id: 'connection-1',
      source: 'polaris',
      collaboratorId: 'pharos',
      conversationId: 'conversation-1',
      relayUrl: 'https://relay.example.com',
      hostId: 'host-1',
      clientId: 'client-1',
      clientSecret: 'secret',
      label: 'Phone',
      hostLabel: 'Mac',
      pushToken: null,
      pushPlatform: null,
      remoteThreadId: null,
      createdAt: 10,
      lastSnapshotAt: 20,
      lastError: null
    }],
    triggerRules: [{
      id: 'trigger-1',
      name: 'Trigger',
      enabled: true,
      source: 'schedule',
      webhookSecret: 'secret',
      schedule: { kind: 'daily', time: '09:00' },
      target: {
        collaboratorId: 'pharos',
        conversationMode: 'follow-latest',
        conversationId: null
      },
      action: { prompt: 'hello' },
      createdAt: 30,
      updatedAt: 40,
      lastRunAt: null,
      nextRunAt: 100,
      lastError: null
    }]
  };
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
});

describe('commitRuntimeRowsMigrationFromCurrentPersistence', () => {
  it('commits runtime rows from current persistence without promoting activeDataSource', async () => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [{
        key: 'runtime-providers-v2',
        value: runtimePayload()
      }]
    }));

    const result = await commitRuntimeRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'runtime-rows-test'
    });

    const providerRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('provider', 'provider-1'))
    );
    const mcpRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('mcp-server', 'mcp-1'))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('runtime'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'runtime',
      version: 7,
      committedAt: 100,
      commitId: 'runtime-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 5,
      projectedObjectCount: 5,
      expectedRepositoryRowCount: 6,
      actualRepositoryRowCount: 6,
      blockers: [],
      warnings: []
    }));
    expect(providerRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        objectId: 'provider:provider-1',
        value: expect.objectContaining({
          apiKey: 'secret-key'
        })
      })
    }));
    expect(mcpRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        objectId: 'mcp-server:mcp-1'
      })
    }));
    expect(pointer).toEqual({
      domain: 'runtime',
      version: 7,
      committedAt: 100,
      commitId: 'runtime-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('normalizes odd runtime payloads before committing repository rows', async () => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [{
        key: 'runtime-providers-v2',
        value: {
          providers: [
            {
              id: 'provider-odd',
              name: '   ',
              protocol: 'unknown-protocol',
              baseUrl: ' https://api.example.com/ ',
              path: '',
              apiKey: ' secret-key ',
              model: '  ',
              capabilities: {
                images: true,
                thinking: true
              }
            },
            {
              id: 'legacy-free',
              name: '免费体验',
              protocol: 'openai-completions',
              baseUrl: '/api',
              path: '/chat/completions',
              apiKey: 'polaris-free',
              model: ''
            }
          ],
          activeProviderId: 'missing-provider',
          mcpServers: [{
            id: 'mcp-odd',
            handle: ' same handle ',
            name: '  ',
            transport: 'http',
            url: ' https://mcp.example.com/ ',
            headers: { Authorization: 'Bearer token' },
            isActive: undefined
          }],
          mcpToolTimeoutSeconds: 0,
          companionConnections: [{
            id: 'connection-odd',
            source: 'unknown',
            collaboratorId: 'nova',
            conversationId: '',
            relayUrl: ' https://relay.example.com/ ',
            hostId: ' host ',
            clientId: ' client ',
            clientSecret: ' secret ',
            label: '',
            hostLabel: '',
            pushPlatform: 'blackberry',
            createdAt: Number.NaN
          }],
          triggerRules: [
            {
              id: 'trigger-empty',
              target: { collaboratorId: '', conversationMode: 'fixed', conversationId: '' },
              action: { prompt: '' }
            },
            {
              id: 'trigger-odd',
              name: '',
              source: 'banana',
              webhookSecret: '',
              schedule: { kind: 'interval', everyMinutes: -5 },
              target: { collaboratorId: 'nova', conversationMode: 'fixed', conversationId: ' c-1 ' },
              action: { prompt: ' hello ' },
              createdAt: 1,
              updatedAt: Number.NaN
            }
          ],
          forceToolUse: true
        }
      }]
    }));

    const result = await commitRuntimeRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'runtime-odd-shapes-test'
    });

    const domainMetaRow = await kvGet<LocalDataCompleteRow<RuntimeDomainMetaRow>>(
      getLocalDataRowKey(getRuntimeDomainMetaLocalDataRef())
    );
    const providerRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('provider', 'provider-odd'))
    );
    const settingsRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow<'settings'>>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('settings', 'runtime-settings'))
    );
    const mcpRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('mcp-server', 'mcp-odd'))
    );
    const triggerRow = await kvGet<LocalDataCompleteRow<RuntimeObjectRow>>(
      getLocalDataRowKey(getRuntimeObjectLocalDataRef('trigger-rule', 'trigger-odd'))
    );
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 5,
      projectedObjectCount: 5,
      expectedRepositoryRowCount: 6,
      actualRepositoryRowCount: 6
    }));
    expect(domainMetaRow?.value).toEqual(expect.objectContaining({
      activeProviderId: 'provider-odd',
      objectCounts: expect.objectContaining({
        provider: 1,
        'mcp-server': 1,
        'companion-connection': 1,
        'trigger-rule': 1
      })
    }));
    expect(providerRow?.value).toEqual(expect.objectContaining({
      objectId: 'provider:provider-odd',
      value: expect.objectContaining({
        name: '线路 1',
        baseUrl: 'https://api.example.com/',
        apiKey: 'secret-key'
      })
    }));
    expect(settingsRow?.value.value).toEqual(expect.objectContaining({
      mcpToolTimeoutSeconds: 300,
      taskModeEnabled: true
    }));
    expect(mcpRow?.value.value).toEqual(expect.objectContaining({
      transport: 'streamable-http',
      headers: [expect.objectContaining({
        key: 'Authorization',
        value: 'Bearer token'
      })]
    }));
    expect(triggerRow?.value).toEqual(expect.objectContaining({
      ownerCollaboratorId: 'nova',
      value: expect.objectContaining({
        source: 'schedule',
        action: { prompt: 'hello' },
        target: expect.objectContaining({
          collaboratorId: 'nova',
          conversationId: 'c-1'
        })
      })
    }));
    expect(activeDataSource).toBeNull();
  });
});
