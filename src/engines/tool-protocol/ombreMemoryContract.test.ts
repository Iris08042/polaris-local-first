import { describe, expect, it } from 'vitest';
import type { McpResolvedToolDefinition } from '../mcpRuntime';
import type { ChatMessage, ToolInvocation } from '../../types/domain';
import type { ToolAction } from '../toolExecutor';
import {
  isOmbreToolAction,
  isOmbreToolInvocation,
  OMBRE_SESSION_GAP_MS,
  resolveOmbreBreathRequired
} from './ombreMemoryContract';

const tools = ['breath', 'hold', 'grow'].map((toolName) => ({
  schemaName: `ombre_${toolName}`,
  serverId: 'ob',
  serverName: 'Ombre Brain',
  serverHandle: 'ombre',
  transport: 'streamable-http',
  url: 'https://ob.example/mcp',
  toolName,
  description: '',
  inputSchema: {}
})) as McpResolvedToolDefinition[];

function user(id: string, timestamp: number): ChatMessage {
  return { id, role: 'user', content: id, timestamp, origin: 'user-input' };
}

function breath(timestamp: number, isError = false): ChatMessage {
  return {
    id: `breath-${timestamp}`,
    role: 'system',
    content: 'breath',
    timestamp,
    origin: 'tool-runtime',
    toolInvocation: {
      id: `invocation-${timestamp}`,
      kind: 'invokeMcpTool',
      status: 'executed',
      title: 'breath',
      summary: 'breath',
      mcpResult: {
        serverId: 'ob',
        serverName: 'Ombre Brain',
        schemaName: 'ombre_breath',
        toolName: 'breath',
        argumentsObject: {},
        isError
      }
    }
  };
}

describe('Ombre conversation session boundary', () => {
  it('requires breath for the first real user message and clears only after a real success', () => {
    expect(resolveOmbreBreathRequired([user('u1', 10)], tools)).toBe(true);
    expect(resolveOmbreBreathRequired([user('u1', 10), breath(11, true)], tools)).toBe(true);
    expect(resolveOmbreBreathRequired([user('u1', 10), breath(12)], tools)).toBe(false);
  });

  it('starts a new breath session after six hours and survives reload from message evidence', () => {
    const firstSession = [user('u1', 10), breath(11), user('u2', 20)];
    expect(resolveOmbreBreathRequired(firstSession, tools)).toBe(false);
    const nextUserAt = 20 + OMBRE_SESSION_GAP_MS;
    expect(resolveOmbreBreathRequired([...firstSession, user('u3', nextUserAt)], tools)).toBe(true);
    expect(resolveOmbreBreathRequired([...firstSession, user('u3', nextUserAt), breath(nextUserAt + 1)], tools)).toBe(false);
  });

  it('does nothing when the resolved MCP catalog is not Ombre Brain', () => {
    expect(resolveOmbreBreathRequired([user('u1', 10)], [])).toBe(false);
  });
});

describe('Ombre activity recognition', () => {
  it('recognizes the common short server name OB', () => {
    const invocation = {
      mcpResult: {
        serverId: 'ob',
        serverName: 'OB',
        schemaName: 'mcp__ob__hold',
        toolName: 'hold'
      }
    } as ToolInvocation;
    const action = {
      kind: 'invokeMcpTool',
      serverId: 'ob',
      serverName: 'OB',
      schemaName: 'mcp__ob__hold',
      toolName: 'hold'
    } as ToolAction;

    expect(isOmbreToolInvocation(invocation)).toBe(true);
    expect(isOmbreToolAction(action)).toBe(true);
  });

  it('does not misclassify unrelated servers that expose similarly named tools', () => {
    const invocation = {
      mcpResult: {
        serverId: 'other',
        serverName: 'Notebook',
        schemaName: 'notebook_hold',
        toolName: 'hold'
      }
    } as ToolInvocation;

    expect(isOmbreToolInvocation(invocation)).toBe(false);
  });
});
