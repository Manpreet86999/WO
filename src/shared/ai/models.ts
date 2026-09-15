/**
 * OpenRouter free-model catalog for Body OS.
 * Ranked for coaching quality: instruction-following chat (not music/vision/safety-only).
 * Verified against OpenRouter /api/v1/models (free tier, 2026).
 */

export type AiProviderId = 'openrouter' | 'nvidia' | 'local' | 'ollama';

export interface FreeModelInfo {
  id: string;
  label: string;
  provider: AiProviderId;
  contextLength: number;
  /** Higher = preferred for coaching */
  rank: number;
  notes: string;
  chatCapable: boolean;
}

/** Small, stable suggestions. Providers change their catalogues often; users may type any current model ID. */
export const OPENROUTER_FREE_CHAT_MODELS: FreeModelInfo[] = [
  {
    id: 'openrouter/free',
    label: 'OpenRouter Free Router',
    provider: 'openrouter',
    contextLength: 200000,
    rank: 90,
    notes: 'Auto-routes to available free models when one is rate-limited.',
    chatCapable: true,
  },
];

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export const NVIDIA_MODELS: FreeModelInfo[] = [
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B Instruct (Nvidia)',
    provider: 'nvidia',
    contextLength: 128000,
    rank: 90,
    notes: 'Standard fast Llama model on Nvidia.',
    chatCapable: true,
  },
];

export const NVIDIA_DEFAULT_MODEL = NVIDIA_MODELS[0].id;

/** Ordered fallback chain when a free model is rate-limited or down. */
export function openRouterFallbackChain(preferred?: string): string[] {
  const ordered = OPENROUTER_FREE_CHAT_MODELS.map((m) => m.id);
  if (preferred && !ordered.includes(preferred)) {
    return [preferred, ...ordered];
  }
  if (preferred) {
    return [preferred, ...ordered.filter((id) => id !== preferred)];
  }
  return ordered;
}

export function modelLabel(id: string): string {
  const all = [...OPENROUTER_FREE_CHAT_MODELS, ...NVIDIA_MODELS];
  return all.find((m) => m.id === id)?.label || id;
}
