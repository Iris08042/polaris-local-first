import { resolveProviderCapability } from '../../engines/provider-runtime';
import type { ProviderProfile } from '../../types/domain';

type GatewayReturnPage = 'root' | 'gateway';

type UseMenuGatewayControllerArgs = {
  api: ProviderProfile;
  onOpenApi: (returnPage: GatewayReturnPage) => void;
  createProvider: () => string;
  duplicateProvider: (providerId: string) => string | null;
  setApiConfig: (patch: Partial<ProviderProfile>) => void;
};

export function buildGatewayPresetPatch(api: ProviderProfile): Partial<ProviderProfile> {
  return {
    name: `${api.name} · 无尽夏 Gateway`,
    protocol: api.protocol,
    baseUrl: api.baseUrl,
    path: api.path,
    apiKey: api.apiKey,
    model: api.model
  };
}

export function resolveGatewayPresetProviderAction(api: ProviderProfile): 'create' | 'duplicate' | 'open-gateway' {
  if (!api.id) return 'open-gateway';
  return resolveProviderCapability(api).route.isBuiltInTrial ? 'create' : 'duplicate';
}

export function useMenuGatewayController({
  api,
  onOpenApi,
  createProvider,
  duplicateProvider,
  setApiConfig
}: UseMenuGatewayControllerArgs) {
  const providerRoute = resolveProviderCapability(api).route;
  const openApiFromRoot = () => onOpenApi('root');
  const openApiFromGateway = () => onOpenApi('gateway');

  const applyGatewayPreset = () => {
    const action = resolveGatewayPresetProviderAction(api);
    if (action === 'open-gateway') {
      onOpenApi('gateway');
      return;
    }

    if (action === 'create') {
      createProvider();
    } else {
      duplicateProvider(api.id);
    }
    setApiConfig(buildGatewayPresetPatch(api));
    onOpenApi('gateway');
  };

  return {
    providerRouteLabelKey: providerRoute.labelKey,
    providerProtocolLabelKey: providerRoute.protocolLabelKey,
    onOpenApiFromRoot: openApiFromRoot,
    onOpenApiFromGateway: openApiFromGateway,
    onSetApiConfig: setApiConfig,
    onApplyGatewayPreset: applyGatewayPreset
  };
}
