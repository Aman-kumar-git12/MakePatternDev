/**
 * Client for the local complexity agent (the `agent/` folder, started with `python app.py`).
 * The agent asks an LLM of your choice for the time and space complexity of a solution, using
 * your own API key. The key is stored only in this browser and sent only to the agent URL.
 */

export type ProviderTier = 'free' | 'paid' | 'local';

export interface AgentProvider {
  id: string;
  label: string;
  tier: ProviderTier;
  defaultModel: string;
  keyUrl: string;
  needsKey: boolean;
}

// Keep in sync with agent/complexity_agent/providers.py.
export const PROVIDERS: AgentProvider[] = [
  { id: 'groq', label: 'Groq', tier: 'free', defaultModel: 'openai/gpt-oss-120b', keyUrl: 'https://console.groq.com/keys', needsKey: true },
  { id: 'gemini', label: 'Google Gemini', tier: 'free', defaultModel: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', tier: 'free', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', keyUrl: 'https://openrouter.ai/keys', needsKey: true },
  { id: 'mistral', label: 'Mistral', tier: 'free', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true },
  { id: 'cerebras', label: 'Cerebras', tier: 'free', defaultModel: 'llama-3.3-70b', keyUrl: 'https://cloud.cerebras.ai', needsKey: true },
  { id: 'github', label: 'GitHub Models', tier: 'free', defaultModel: 'openai/gpt-4.1-mini', keyUrl: 'https://github.com/settings/tokens', needsKey: true },
  { id: 'huggingface', label: 'Hugging Face', tier: 'free', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct', keyUrl: 'https://huggingface.co/settings/tokens', needsKey: true },
  { id: 'openai', label: 'OpenAI', tier: 'paid', defaultModel: 'gpt-4.1-mini', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true },
  { id: 'anthropic', label: 'Anthropic Claude', tier: 'paid', defaultModel: 'claude-opus-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', needsKey: true },
  { id: 'deepseek', label: 'DeepSeek', tier: 'paid', defaultModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', needsKey: true },
  { id: 'xai', label: 'xAI Grok', tier: 'paid', defaultModel: 'grok-3-mini', keyUrl: 'https://console.x.ai', needsKey: true },
  { id: 'together', label: 'Together AI', tier: 'paid', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyUrl: 'https://api.together.ai/settings/api-keys', needsKey: true },
  { id: 'ollama', label: 'Ollama (local)', tier: 'local', defaultModel: 'llama3.2', keyUrl: 'https://ollama.com/download', needsKey: false },
];

export const TIER_LABEL: Record<ProviderTier, string> = { free: 'Free tier', paid: 'Paid', local: 'Local (no key)' };

export const DEFAULT_AGENT_URL = 'http://127.0.0.1:8001';
export const MAX_AGENT_CODE = 20_000;
export const AGENT_TIMEOUT_MS = 60_000;

export const providerById = (id: string): AgentProvider | undefined => PROVIDERS.find((p) => p.id === id);

export interface ComplexityResult {
  provider: string;
  model: string;
  time_complexity: string;
  space_complexity: string;
  time_explanation: string;
  space_explanation: string;
  variables: { name: string; meaning: string }[];
  /** True when no asymptotically better complexity is known for this problem. */
  is_optimal: boolean;
  /** The better complexity, e.g. "O(n) time, O(1) space"; empty when optimal. */
  better_complexity: string;
  /** How to reach the better complexity, or why the code is already optimal. */
  suggestion: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AgentSettings {
  url: string;
  provider: string;
  keys: Record<string, string>;
  models: Record<string, string>;
}

/** The agent's base URL without a trailing slash; throws for anything that isn't http(s). */
export function agentBaseUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error('The complexity agent URL is not a valid URL — fix it in settings.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('The complexity agent URL must start with http:// or https://.');
  if (u.username || u.password) throw new Error('The complexity agent URL must not contain a username or password.');
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/** Key and model to use for the selected provider. */
export function selection(s: AgentSettings): { provider: AgentProvider; apiKey: string; model: string } {
  const provider = providerById(s.provider) ?? (PROVIDERS[0] as AgentProvider);
  return { provider, apiKey: (s.keys[provider.id] ?? '').trim(), model: (s.models[provider.id] ?? '').trim() };
}

/** Why analysis can't run with these settings, or null if it can. */
export function missingSetup(s: AgentSettings): string | null {
  const { provider, apiKey } = selection(s);
  return provider.needsKey && !apiKey ? `Add your ${provider.label} API key in settings → AI code review.` : null;
}

const str = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length <= max;

/** Checks the agent's reply has the documented shape; throws otherwise. */
export function parseComplexityResult(json: unknown): ComplexityResult {
  const r = json as Record<string, unknown> | null;
  const bad = () => new Error('The complexity agent sent an answer in an unexpected shape.');
  if (!r || typeof r !== 'object') throw bad();
  for (const k of ['provider', 'model', 'time_complexity', 'space_complexity'] as const) if (!str(r[k], 200) || !r[k]) throw bad();
  for (const k of ['time_explanation', 'space_explanation'] as const) if (!str(r[k])) throw bad();
  const vars = Array.isArray(r.variables) ? r.variables : [];
  const variables = vars
    .filter((v): v is { name: string; meaning: string } => !!v && typeof v === 'object' && str((v as { name: unknown }).name, 80) && str((v as { meaning: unknown }).meaning, 400))
    .slice(0, 10)
    .map((v) => ({ name: v.name, meaning: v.meaning }));
  const confidence = r.confidence === 'high' || r.confidence === 'low' ? r.confidence : 'medium';
  return {
    provider: r.provider as string,
    model: r.model as string,
    time_complexity: r.time_complexity as string,
    space_complexity: r.space_complexity as string,
    time_explanation: r.time_explanation as string,
    space_explanation: r.space_explanation as string,
    variables,
    // Older agents don't send the review fields; treat their answers as having no verdict.
    is_optimal: r.is_optimal !== false,
    better_complexity: r.is_optimal === false && str(r.better_complexity, 200) ? r.better_complexity : '',
    suggestion: str(r.suggestion, 1000) ? r.suggestion : '',
    confidence,
  };
}

function statusMessage(status: number, detail: string | undefined, label: string): string {
  const d = detail ? ` (${detail})` : '';
  switch (status) {
    case 401:
    case 403:
      return detail || `${label} rejected the API key — check it in settings.`;
    case 422:
      return detail || 'The agent could not analyse this input.';
    case 429:
      return detail || `${label} rate limit reached — wait a minute and retry.`;
    case 504:
      return detail || `${label} took too long to answer — retry.`;
    case 400:
      return detail || 'The agent rejected the request.';
    default:
      return `Complexity agent error ${status}${d}`;
  }
}

export interface AnalyzeComplexityInput {
  url: string;
  provider: string;
  apiKey: string;
  model?: string;
  code: string;
  language?: string;
  title?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export async function analyzeComplexity(input: AnalyzeComplexityInput): Promise<ComplexityResult> {
  const base = agentBaseUrl(input.url);
  const provider = providerById(input.provider);
  if (!provider) throw new Error(`Unknown provider "${input.provider}".`);
  if (provider.needsKey && !input.apiKey.trim()) throw new Error(`Add your ${provider.label} API key in settings → AI code review.`);
  if (!input.code.trim()) throw new Error('There is no code to analyse.');
  if (input.code.length > MAX_AGENT_CODE) throw new Error(`The code is too long for the agent (max ${MAX_AGENT_CODE.toLocaleString()} characters).`);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.needsKey) headers['X-API-Key'] = input.apiKey.trim();
  const body = {
    provider: provider.id,
    model: input.model?.trim() ?? '',
    code: input.code,
    ...(input.language ? { language: input.language.slice(0, 40) } : {}),
    ...(input.title ? { title: input.title.slice(0, 200) } : {}),
  };
  const timeout = AbortSignal.timeout(AGENT_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  const doFetch = input.fetch ?? fetch;

  let res: Response;
  try {
    res = await doFetch(`${base}/api/analyze`, { method: 'POST', headers, body: JSON.stringify(body), signal, credentials: 'omit' });
  } catch (e) {
    if (timeout.aborted) throw new Error('The complexity agent took too long to answer — retry.');
    if (input.signal?.aborted) throw new Error('The analysis was cancelled.');
    void e;
    throw new Error(`Can't reach the complexity agent at ${base} — start it with \`python app.py\` in the agent folder.`);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    const raw = (json as { detail?: unknown } | null)?.detail;
    const detail = typeof raw === 'string' ? raw.slice(0, 300) : undefined;
    throw new Error(statusMessage(res.status, detail, provider.label));
  }
  return parseComplexityResult(json);
}

/** Pings the agent's /health endpoint. Resolves to true when it answers `{status: "ok"}`. */
export async function checkAgentHealth(url: string, doFetch: typeof fetch = fetch): Promise<boolean> {
  const base = agentBaseUrl(url);
  try {
    const res = await doFetch(`${base}/health`, { signal: AbortSignal.timeout(5_000), credentials: 'omit' });
    if (!res.ok) return false;
    return ((await res.json()) as { status?: unknown })?.status === 'ok';
  } catch {
    return false;
  }
}
