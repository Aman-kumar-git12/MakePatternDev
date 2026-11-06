import { describe, expect, it } from 'vitest';
import { analyzeWithClaude } from '../src/agents/codeAnalysis/claude';

const REPORT = {
  summary: 'Finds the longest substring without repeats with a sliding window.',
  approach: 'Sliding Window',
  algorithms: [{ name: 'Sliding window', role: 'Keeps a window with unique characters' }],
  dataStructures: ['hash map'],
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(k)',
  complexityExplanation: 'Each index enters and leaves the window once.',
  readability: { score: 14, verdict: 'Clear.', strengths: ['Descriptive names'], issues: [] },
  improvements: [{ title: 'Store last index', detail: 'Jump left directly instead of shrinking one by one.' }],
  edgeCaseRisks: ['Empty string'],
  optimalApproach: 'Already optimal.',
};

function mockApi(body: unknown, status = 200) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const message = (stop_reason: string, text = JSON.stringify(REPORT)) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const input = { apiKey: 'sk-ant-test', code: 'print(1)', lang: 'python3', title: 'Two Sum' };

describe('analyzeWithClaude', () => {
  it('sends a structured-output request with refusal fallbacks and parses the report', async () => {
    const { calls, fetchImpl } = mockApi(message('end_turn'));
    const report = await analyzeWithClaude({ ...input, model: 'claude-opus-5-5', fetch: fetchImpl });

    expect(report.approach).toBe('Sliding Window');
    expect(report.readability.score).toBe(10); // clamped to 1..10
    const req = calls[0]!;
    expect(req.url).toContain('/v1/messages');
    expect(req.headers.get('authorization')).toBe('Bearer sk-ant-test');
    expect(req.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.fallbacks).toBe('default');
    const oc = req.body.output_config as { effort: string; format: { type: string; schema: { properties: object } } };
    expect(oc.effort).toBe('medium');
    expect(oc.format.type).toBe('json_schema');
    expect(Object.keys(oc.format.schema.properties)).toContain('timeComplexity');
    expect(JSON.stringify(req.body.messages)).toContain('<code>\\nprint(1)\\n</code>');
  });

  it('omits fallbacks for models that do not support them', async () => {
    const { calls, fetchImpl } = mockApi(message('end_turn'));
    await analyzeWithClaude({ ...input, model: 'claude-haiku-5-5', fetch: fetchImpl });
    expect(calls[0]!.body.fallbacks).toBeUndefined();
    expect(calls[0]!.headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('reports refusals and truncation', async () => {
    await expect(analyzeWithClaude({ ...input, model: 'claude-opus-5-5', fetch: mockApi(message('refusal', '')).fetchImpl })).rejects.toThrow(/declined/);
    await expect(
      analyzeWithClaude({ ...input, model: 'claude-opus-5-5', fetch: mockApi(message('max_tokens', '{"summary": "x')).fetchImpl }),
    ).rejects.toThrow(/cut off|structured/);
  });

  it('turns API errors into friendly messages', async () => {
    const err = (type: string) => ({ type: 'error', error: { type, message: 'nope' } });
    await expect(analyzeWithClaude({ ...input, model: 'claude-opus-5-5', fetch: mockApi(err('authentication_error'), 401).fetchImpl })).rejects.toThrow(/Invalid Anthropic API key/);
    await expect(analyzeWithClaude({ ...input, model: 'claude-opus-5-5', fetch: mockApi(err('rate_limit_error'), 429).fetchImpl })).rejects.toThrow(/Rate limited/);
  });
});
