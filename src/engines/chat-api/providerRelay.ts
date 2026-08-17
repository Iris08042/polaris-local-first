import { Capacitor } from '@capacitor/core';
import type { BuiltRequest } from './chatApiTypes';
export {
  hasProviderRelayAuthHeader,
  isAllowedProviderRelayTarget,
  isProviderModelListRelayTarget,
  sanitizeProviderRelayHeaders
} from './providerRelayShared';
import { isAllowedProviderRelayTarget } from './providerRelayShared';

export const ANTHROPIC_BROWSER_ACCESS_HEADER = 'anthropic-dangerous-direct-browser-access';

const ENDLESS_SUMMER_WEB_ORIGIN = 'https://polaris.yichen888.top';
const ENDLESS_SUMMER_PROVIDER_RELAY_PATH = '/gateway/api/provider-relay';
const DEFAULT_PROVIDER_RELAY_PATH = '/api/provider-relay';

export function isOfficialAnthropicApiEndpoint(endpointText: string) {
  try {
    const endpoint = new URL(endpointText);
    return endpoint.hostname === 'api.anthropic.com';
  } catch {
    return false;
  }
}

function isOfficialAnthropicMessagesEndpoint(request: BuiltRequest) {
  if (request.provider !== 'anthropic-messages') return false;
  if (!isOfficialAnthropicApiEndpoint(request.endpoint)) return false;

  try {
    return new URL(request.endpoint).pathname.replace(/\/+$/, '') === '/v1/messages';
  } catch {
    return false;
  }
}

export function shouldUseAnthropicBrowserDirectAccess(request: BuiltRequest) {
  if (typeof window === 'undefined') return false;
  return isOfficialAnthropicMessagesEndpoint(request);
}

export function canFallbackThroughProviderRelay(endpointText: string) {
  if (!isAllowedProviderRelayTarget(endpointText)) return false;
  if (Capacitor.isNativePlatform()) return false;
  if (typeof window === 'undefined') return false;

  const currentOrigin = window.location?.origin;
  if (typeof currentOrigin !== 'string' || !currentOrigin) return false;

  try {
    return new URL(endpointText).origin !== currentOrigin;
  } catch {
    return false;
  }
}

function isEndlessSummerWebDeployment() {
  return (
    typeof window !== 'undefined'
    && window.location?.origin === ENDLESS_SUMMER_WEB_ORIGIN
    && !Capacitor.isNativePlatform()
  );
}

export function shouldRouteThroughEndlessSummerGateway(endpointText: string) {
  return isEndlessSummerWebDeployment() && canFallbackThroughProviderRelay(endpointText);
}

export function resolveProviderRelayPath() {
  return isEndlessSummerWebDeployment()
    ? ENDLESS_SUMMER_PROVIDER_RELAY_PATH
    : DEFAULT_PROVIDER_RELAY_PATH;
}
