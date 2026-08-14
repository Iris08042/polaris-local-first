import type { MemoryVectorRetrievalSettings } from '../types/domain';

export const DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS: MemoryVectorRetrievalSettings = {
  enabled: false,
  baseUrl: '',
  path: '/embeddings',
  apiKey: '',
  model: '',
  dimensions: null,
  lastUpdatedAt: 0
};

export function normalizeMemoryVectorRetrievalSettings(
  value?: Partial<MemoryVectorRetrievalSettings> | null
): MemoryVectorRetrievalSettings {
  const rawLastUpdatedAt = value?.lastUpdatedAt;
  const rawDimensions = value?.dimensions;

  return {
    enabled: false,
    baseUrl: value?.baseUrl?.trim() ?? '',
    path: value?.path?.trim() || '/embeddings',
    apiKey: value?.apiKey?.trim() ?? '',
    model: value?.model?.trim() ?? '',
    dimensions:
      typeof rawDimensions === 'number' && Number.isFinite(rawDimensions) && rawDimensions > 0
        ? Math.floor(rawDimensions)
        : null,
    lastUpdatedAt:
      typeof rawLastUpdatedAt === 'number' && Number.isFinite(rawLastUpdatedAt) && rawLastUpdatedAt >= 0
        ? Math.floor(rawLastUpdatedAt)
        : 0
  };
}
