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

/** Curated free chat models — best first for training coaching. */
export const OPENROUTER_FREE_CHAT_MODELS: FreeModelInfo[] = [
  {
    id: 'deepseek/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro (Paid)',
    provider: 'openrouter',
    contextLength: 128000,
    rank: 110,
    notes: 'Premium DeepSeek V4 model. Requires paid OpenRouter key.',
    chatCapable: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (free) — recommended',
    provider: 'openrouter',
    contextLength: 262144,
    rank: 100,
    notes: 'Strong instruction following, large context, free. Best default coach model.',
    chatCapable: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B (free)',
    provider: 'openrouter',
    contextLength: 262144,
    rank: 95,
    notes: 'Efficient MoE-style free model; solid coaching fallback.',
    chatCapable: true,
  },
  {
    id: 'openrouter/free',
    label: 'OpenRouter Free Router',
    provider: 'openrouter',
    contextLength: 200000,
    rank: 90,
    notes: 'Auto-routes to available free models when one is rate-limited.',
    chatCapable: true,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT-OSS 20B (free)',
    provider: 'openrouter',
    contextLength: 131072,
    rank: 85,
    notes: 'Open-weight style free model; good general text.',
    chatCapable: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b:free',
    label: 'Nemotron 3 Nano 30B (free)',
    provider: 'openrouter',
    contextLength: 256000,
    rank: 80,
    notes: 'NVIDIA free nano; fast when available.',
    chatCapable: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Nemotron 3 Super 120B (free)',
    provider: 'openrouter',
    contextLength: 262144,
    rank: 78,
    notes: 'Larger free NVIDIA model; may be busier / rate-limited.',
    chatCapable: true,
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    label: 'Laguna XS 2.1 (free)',
    provider: 'openrouter',
    contextLength: 262144,
    rank: 70,
    notes: 'Free code/chat capable model; secondary fallback.',
    chatCapable: true,
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    label: 'Laguna S 2.1 (free)',
    provider: 'openrouter',
    contextLength: 262144,
    rank: 68,
    notes: 'Larger Laguna free variant.',
    chatCapable: true,
  },
];

export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_FREE_CHAT_MODELS[0].id;

export const NVIDIA_MODELS: FreeModelInfo[] = [
  {
    id: 'deepseek-ai/deepseek-r1',
    label: 'DeepSeek R1 (Nvidia)',
    provider: 'nvidia',
    contextLength: 128000,
    rank: 100,
    notes: 'Reasoning model from DeepSeek via Nvidia.',
    chatCapable: true,
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B Instruct (Nvidia)',
    provider: 'nvidia',
    contextLength: 128000,
    rank: 90,
    notes: 'Standard fast Llama model on Nvidia.',
    chatCapable: true,
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B Instruct (Nvidia)',
    provider: 'nvidia',
    contextLength: 128000,
    rank: 95,
    notes: 'Larger Llama model on Nvidia.',
    chatCapable: true,
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B Instruct (Nvidia)',
    provider: 'nvidia',
    contextLength: 128000,
    rank: 98,
    notes: 'Newest large Llama model on Nvidia.',
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
