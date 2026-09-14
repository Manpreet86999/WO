import { PORT } from '../config.js';
import type { AiProviderId } from './models.js';
import { DEFAULT_OPENROUTER_MODEL, NVIDIA_DEFAULT_MODEL, openRouterFallbackChain } from './models.js';
import { executeMcpTool } from './mcp.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  provider: AiProviderId | string;
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Try fallback free models on OpenRouter failure */
  useFallback?: boolean;
  /** Optional array of tools (e.g. MCP tools) for the model to use */
  tools?: any[];
  /** If set, tool calls are dispatched here first (skin tools, etc). Unknown names fall back to MCP. */
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface ChatSuccess {
  ok: true;
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  attempts: Array<{ model: string; ok: boolean; error?: string; status?: number }>;
}

export interface ChatFailure {
  ok: false;
  error: string;
  attempts: Array<{ model: string; ok: boolean; error?: string; status?: number }>;
}

export type ChatResult = ChatSuccess | ChatFailure;

function endpoint(provider: string): string {
  if (provider === 'nvidia') return 'https://integrate.api.nvidia.com/v1/chat/completions';
  if (provider === 'ollama') return 'http://127.0.0.1:11434/v1/chat/completions';
  return 'https://openrouter.ai/api/v1/chat/completions';
}

function headersFor(provider: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey && provider !== 'ollama') {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = `http://127.0.0.1:${PORT}`;
    headers['X-Title'] = 'Body OS';
  }
  return headers;
}

async function oneShot(
  provider: string,
  apiKey: string,
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number,
  tools?: any[],
): Promise<{ ok: true; content: string; tool_calls?: any[] } | { ok: false; error: string; status?: number }> {
  const started = Date.now();
  try {
    const payloadReq: any = {
      model,
      temperature,
      messages,
    };
    if (tools && tools.length > 0) {
      payloadReq.tools = tools;
    }
    // Ollama (especially reasoning models) may need to generate many reasoning tokens before outputting content.
    // Restricting max_tokens causes them to abort early with empty content.
    if (provider !== 'ollama') {
      payloadReq.max_tokens = maxTokens;
    }
    
    const response = await fetch(endpoint(provider), {
      method: 'POST',
      headers: headersFor(provider, apiKey),
      body: JSON.stringify(payloadReq),
      signal: AbortSignal.timeout(60000), // increased timeout for tool calling models
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
      choices?: Array<{ message?: { content?: string, tool_calls?: any[] } }>;
    };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload.error?.message || payload.message || `HTTP ${response.status}`,
      };
    }
    const msg = payload.choices?.[0]?.message;
    const content = msg?.content?.trim() || '';
    const tool_calls = msg?.tool_calls;
    
    if (!content && (!tool_calls || tool_calls.length === 0)) {
      return { ok: false, status: response.status, error: 'Empty model response' };
    }
    return { ok: true, content, tool_calls };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Chat completion with OpenRouter free-model fallback chain.
 * Local provider short-circuits (no network).
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const provider = (req.provider || 'local').toLowerCase();
  const attempts: ChatSuccess['attempts'] = [];

  if (provider === 'local') {
    return { ok: false, error: 'Local coach only (no network).', attempts };
  }
  if (provider !== 'ollama' && !req.apiKey) {
    return { ok: false, error: 'No AI provider or API key configured.', attempts };
  }

  const t0 = Date.now();
  let models: string[];
  if (provider === 'nvidia') {
    models = [req.model || NVIDIA_DEFAULT_MODEL];
  } else if (provider === 'openrouter') {
    models =
      req.useFallback === false
        ? [req.model || DEFAULT_OPENROUTER_MODEL]
        : openRouterFallbackChain(req.model || DEFAULT_OPENROUTER_MODEL);
  } else {
    models = [req.model || DEFAULT_OPENROUTER_MODEL];
  }

  for (const model of models) {
    let currentMessages = [...req.messages];
    let isDone = false;
    let finalContent = '';
    let callAttempts = 0;

    while (!isDone && callAttempts < 5) {
      callAttempts++;
      const result = await oneShot(
        provider === 'nvidia' ? 'nvidia' : provider === 'ollama' ? 'ollama' : 'openrouter',
        req.apiKey || '',
        model,
        currentMessages,
        req.temperature ?? 0.35,
        req.maxTokens ?? 500,
        req.tools
      );
      
      if (!result.ok) {
        attempts.push({ model, ok: false, error: result.error, status: result.status });
        if (result.status === 401 || result.status === 403) return { ok: false, error: result.error, attempts };
        break; // Break the while loop to try next model in fallback chain
      }

      if (result.tool_calls && result.tool_calls.length > 0) {
        // The AI requested a tool call
        currentMessages.push({
          role: 'assistant',
          content: result.content || '',
          tool_calls: result.tool_calls
        } as any);

        // Execute all requested tools
        for (const tc of result.tool_calls) {
          try {
            const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments || '{}') : tc.function.arguments;
            const name = String(tc.function.name || '');
            console.log(`[AI] Executing tool ${name}...`);
            let toolResult: unknown;
            if (req.executeTool) {
              toolResult = await req.executeTool(name, args || {});
            } else {
              toolResult = await executeMcpTool(name, args);
            }
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name,
              content: JSON.stringify(toolResult)
            } as any);
          } catch (err: any) {
            console.error(`[AI] Tool error:`, err);
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify({ error: err.message })
            } as any);
          }
        }
        // Loop continues to send tool results back to the model
      } else {
        // Final response received
        finalContent = result.content;
        isDone = true;
      }
    }

    if (isDone) {
      attempts.push({ model, ok: true });
      return {
        ok: true,
        content: finalContent,
        model,
        provider: provider === 'nvidia' ? 'nvidia' : provider === 'ollama' ? 'ollama' : 'openrouter',
        latencyMs: Date.now() - t0,
        attempts,
      };
    }
  }

  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    error: last?.error || 'All AI models failed',
    attempts,
  };
}

/** Lightweight probe used by /api/ai/test and model ranking. */
export async function probeModel(
  apiKey: string,
  model: string,
  provider: 'openrouter' | 'nvidia' | 'ollama' = 'openrouter',
): Promise<{ ok: boolean; model: string; latencyMs: number; error?: string; sample?: string }> {
  const t0 = Date.now();
  const result = await oneShot(
    provider,
    apiKey,
    model,
    [
      {
        role: 'system',
        content: 'Reply with exactly one short sentence confirming you are a workout coach AI.',
      },
      { role: 'user', content: 'Ping. Confirm ready for training coaching.' },
    ],
    0.2,
    60,
  );
  if (!result.ok) {
    return { ok: false, model, latencyMs: Date.now() - t0, error: result.error };
  }
  return {
    ok: true,
    model,
    latencyMs: Date.now() - t0,
    sample: result.content.slice(0, 160),
  };
}

export async function autoRegulateSession(
  req: ChatRequest
): Promise<ChatResult> {
  // Use slightly higher temp for more dynamic changes
  req.temperature = 0.5;
  return chatCompletion(req);
}
