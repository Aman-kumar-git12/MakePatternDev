import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const { fakeBrowser } = await import('wxt/testing/fake-browser');
const agent = await import('../src/lib/complexityAgent');
const storage = await import('../src/lib/storage');
const ca = await import('../src/agents/codeAnalysis');
const { parseMessage } = await import('../src/lib/messages');
import type { Analysis } from '../src/lib/types';

const RESULT = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  time_complexity: 'O(n log n)',
  space_complexity: 'O(n)',
  time_explanation: 'Sorting dominates.',
  space_explanation: 'The sorted copy.',
  variables: [{ name: 'n', meaning: 'length of nums' }],
  confidence: 'high',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(res: Response | Error) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    if (res instanceof Error) throw res;
    return res;
  });
}

const input = (over: Partial<Parameters<typeof agent.analyzeComplexity>[0]> = {}) => ({
  url: 'http://127.0.0.1:8001/',
  provider: 'groq',
  apiKey: ' gsk_test ',
  model: '',
  code: 'nums.sort()',
  language: 'python',
  title: 'Two Sum',
  ...over,
});

describe('analyzeComplexity', () => {
  it('POSTs to /api/analyze with the key header and returns the parsed result', async () => {
    const f = mockFetch(json(200, RESULT));
    const r = await agent.analyzeComplexity(input({ fetch: f as unknown as typeof fetch }));
    expect(r).toEqual({ ...RESULT, is_optimal: true, better_complexity: '', suggestion: '' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:8001/api/analyze');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>)['X-API-Key']).toBe('gsk_test');
    expect(init!.credentials).toBe('omit');
    expect(JSON.parse(init!.body as string)).toEqual({ provider: 'groq', model: '', code: 'nums.sort()', language: 'python', title: 'Two Sum' });
  });

  it('sends no key header for ollama and needs no key', async () => {
    const f = mockFetch(json(200, { ...RESULT, provider: 'ollama' }));
    await agent.analyzeComplexity(input({ provider: 'ollama', apiKey: '', fetch: f as unknown as typeof fetch }));
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>)['X-API-Key']).toBeUndefined();
  });

  it('rejects a missing key, empty or oversized code, unknown providers and non-http URLs before any request', async () => {
    const f = mockFetch(json(200, RESULT));
    const run = (over: object) => agent.analyzeComplexity(input({ ...over, fetch: f as unknown as typeof fetch }));
    await expect(run({ apiKey: '  ' })).rejects.toThrow('Add your Groq API key');
    await expect(run({ code: '   ' })).rejects.toThrow('no code');
    await expect(run({ code: 'x'.repeat(agent.MAX_AGENT_CODE + 1) })).rejects.toThrow('too long');
    await expect(run({ provider: 'nope' })).rejects.toThrow('Unknown provider');
    await expect(run({ url: 'file:///etc/passwd' })).rejects.toThrow('http:// or https://');
    await expect(run({ url: 'not a url' })).rejects.toThrow('not a valid URL');
    await expect(run({ url: 'http://user:pw@localhost:8001' })).rejects.toThrow('username or password');
    expect(f).not.toHaveBeenCalled();
  });

  it('maps a network failure to a "start the agent" hint', async () => {
    const f = mockFetch(new TypeError('Failed to fetch'));
    await expect(agent.analyzeComplexity(input({ fetch: f as unknown as typeof fetch }))).rejects.toThrow(
      "Can't reach the complexity agent at http://127.0.0.1:8001 — start it with `python app.py`",
    );
  });

  it.each([
    [401, { detail: 'Groq rejected the API key.' }, 'Groq rejected the API key.'],
    [401, {}, 'Groq rejected the API key — check it in settings.'],
    [429, {}, 'rate limit'],
    [504, {}, 'took too long'],
    [502, { detail: 'upstream broke' }, 'Complexity agent error 502 (upstream broke)'],
    [500, 'not json', 'Complexity agent error 500'],
  ])('maps HTTP %i to a friendly message', async (status, body, message) => {
    const res = typeof body === 'string' ? new Response(body, { status }) : json(status, body);
    await expect(agent.analyzeComplexity(input({ fetch: mockFetch(res) as unknown as typeof fetch }))).rejects.toThrow(message);
  });

  it('rejects replies in the wrong shape and cleans up odd fields', async () => {
    const bad = mockFetch(json(200, { ...RESULT, time_complexity: 42 }));
    await expect(agent.analyzeComplexity(input({ fetch: bad as unknown as typeof fetch }))).rejects.toThrow('unexpected shape');
    const odd = agent.parseComplexityResult({ ...RESULT, confidence: 'certain', variables: [{ name: 'n' }, 'x', { name: 'm', meaning: 'rows' }] });
    expect(odd.confidence).toBe('medium');
    expect(odd.variables).toEqual([{ name: 'm', meaning: 'rows' }]);
  });

  it('reads the complexity review verdict', () => {
    const better = agent.parseComplexityResult({ ...RESULT, is_optimal: false, better_complexity: 'O(n)', suggestion: 'Use a hash map.' });
    expect(better).toMatchObject({ is_optimal: false, better_complexity: 'O(n)', suggestion: 'Use a hash map.' });
    // Optimal answers never show a "better" complexity.
    expect(agent.parseComplexityResult({ ...RESULT, is_optimal: true, better_complexity: 'O(1)' }).better_complexity).toBe('');
    // Older agents without the review fields still work.
    expect(agent.parseComplexityResult(RESULT)).toMatchObject({ is_optimal: true, better_complexity: '', suggestion: '' });
  });
});

describe('agent settings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('defaults to Groq on 127.0.0.1:8001 and merges stored keys/models', async () => {
    expect((await storage.getSettings()).agent).toEqual({ url: 'http://127.0.0.1:8001', provider: 'groq', keys: {}, models: {} });
    await fakeBrowser.storage.local.set({ settings: { agent: { provider: 'gemini', keys: { gemini: 'k' } } } });
    expect((await storage.getSettings()).agent).toEqual({ url: 'http://127.0.0.1:8001', provider: 'gemini', keys: { gemini: 'k' }, models: {} });
  });

  it('selection/missingSetup pick the key and model for the chosen provider', () => {
    const s = { url: 'http://localhost:8001', provider: 'openai', keys: { openai: ' sk ' }, models: { openai: ' gpt-x ' } };
    expect(agent.selection(s)).toMatchObject({ apiKey: 'sk', model: 'gpt-x' });
    expect(agent.selection(s).provider.id).toBe('openai');
    expect(agent.missingSetup(s)).toBeNull();
    expect(agent.missingSetup({ ...s, keys: {} })).toContain('OpenAI API key');
    expect(agent.missingSetup({ ...s, provider: 'ollama', keys: {} })).toBeNull();
    expect(agent.selection({ ...s, provider: 'gone' }).provider.id).toBe('groq');
  });

  it('has one entry per provider id, each in a known tier', () => {
    const ids = agent.PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('groq');
    for (const p of agent.PROVIDERS) expect(['free', 'paid', 'local']).toContain(p.tier);
  });
});

const analysis = (id: string, over: Partial<Analysis> = {}): Analysis => ({
  id,
  createdAt: Date.now(),
  title: 'Two Sum · Accepted',
  code: 'nums.sort()',
  heuristic: {
    language: 'python',
    readability: {
      score: 90,
      grade: 'A',
      issues: [],
      metrics: { lines: 1, codeLines: 1, commentRatio: 0, avgLineLength: 8, maxLineLength: 8, maxNesting: 0, longestFunction: 0, shortNames: [], magicNumbers: 0 },
    },
    algorithms: [],
    complexity: { time: 'O(1)', reason: '' },
  },
  ...over,
});

describe('analyzeComplexity message and background handler', () => {
  beforeEach(() => fakeBrowser.reset());

  it('accepts a well-formed analyzeComplexity message only', () => {
    expect(parseMessage({ type: 'analyzeComplexity', analysisId: 'a' })).toEqual({ type: 'analyzeComplexity', analysisId: 'a' });
    expect(() => parseMessage({ type: 'analyzeComplexity' })).toThrow();
  });

  it('records the result on the analysis', async () => {
    await storage.setItem('analyses', { a: analysis('a') });
    await storage.setItem('settings', { ...storage.DEFAULT_SETTINGS, agent: { ...storage.DEFAULT_SETTINGS.agent, keys: { groq: 'gsk' } } });
    const f = mockFetch(json(200, RESULT));
    const r = await ca.analyzeComplexityFor('a', { fetch: f as unknown as typeof fetch });
    expect(r.time_complexity).toBe('O(n log n)');
    const body = JSON.parse(f.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ provider: 'groq', language: 'python', title: 'Two Sum · Accepted' });
    expect((await storage.getItem('analyses')).a).toMatchObject({ complexityAiStatus: 'done', complexityAi: RESULT });
  });

  it('records errors on the analysis and rethrows', async () => {
    await storage.setItem('analyses', { a: analysis('a', { complexityAi: RESULT as never, complexityAiStatus: 'done' }) });
    // No key configured for groq.
    await expect(ca.analyzeComplexityFor('a', { fetch: mockFetch(json(200, RESULT)) as unknown as typeof fetch })).rejects.toThrow('Add your Groq API key');
    const a = (await storage.getItem('analyses')).a!;
    expect(a.complexityAiStatus).toBe('error');
    expect(a.complexityAiError).toContain('Groq API key');
    expect(a.complexityAi).toEqual(RESULT); // the previous result is kept
  });

  it('rejects a missing analysis', async () => {
    await expect(ca.analyzeComplexityFor('nope')).rejects.toThrow('Analysis not found');
  });

  it('recovery marks a complexity call left running by a dead worker as interrupted', async () => {
    await storage.setItem('analyses', { a: analysis('a', { complexityAiStatus: 'running' }), b: analysis('b') });
    expect(await ca.recoverInterruptedAnalyses()).toBe(1);
    const all = await storage.getItem('analyses');
    expect(all.a).toMatchObject({ complexityAiStatus: 'error', complexityAiError: ca.AI_INTERRUPTED });
    expect(all.b!.complexityAiStatus).toBeUndefined();
  });
});

describe('checkAgentHealth', () => {
  it('is true only for {status: "ok"}', async () => {
    expect(await agent.checkAgentHealth('http://127.0.0.1:8001', mockFetch(json(200, { status: 'ok' })) as unknown as typeof fetch)).toBe(true);
    expect(await agent.checkAgentHealth('http://127.0.0.1:8001', mockFetch(json(500, {})) as unknown as typeof fetch)).toBe(false);
    expect(await agent.checkAgentHealth('http://127.0.0.1:8001', mockFetch(new TypeError('x')) as unknown as typeof fetch)).toBe(false);
  });
});
