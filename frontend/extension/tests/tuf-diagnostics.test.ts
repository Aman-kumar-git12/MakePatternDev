import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

const html = () => gunzipSync(readFileSync(new URL('./fixtures/tuf-potd.html.gz', import.meta.url))).toString('utf8');
const page = (over: Partial<{ status: number; text: string; url: string }> = {}) => async () => ({
  status: 200,
  text: html(),
  url: 'https://takeuforward.org/potd',
  contentType: 'text/html',
  ...over,
});

describe('TUF POTD diagnostics', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const { resetTufCache } = await import('../src/agents/potd/tuf');
    resetTufCache();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('records every stage of a successful read with timings and the HTTP status', async () => {
    const { fetchTufPotd } = await import('../src/agents/potd/tuf');
    const { readTufDiagnostics } = await import('../src/lib/tufDiagnostics');
    const p = await fetchTufPotd(1, page(), page());
    expect(p.title).toBe("Find row with maximum 1's");
    const [run] = await readTufDiagnostics();
    expect(run!.ok).toBe(true);
    expect(run!.result).toEqual({ title: "Find row with maximum 1's", url: "https://takeuforward.org/practice/dsa/find-row-with-maximum-1's", attempt: 'logged-in' });
    expect(run!.stages.map((s) => `${s.attempt}:${s.stage}:${s.ok}`)).toEqual([
      'logged-in:request:true',
      'logged-in:load:true',
      'logged-in:extract-title:true',
      'logged-in:find-question-link:true',
      'logged-in:validate-url:true',
    ]);
    expect(run!.stages[0]!.status).toBe(200);
    expect(run!.stages.every((s) => typeof s.ms === 'number' && s.ms >= 0)).toBe(true);
    expect(run!.stages[2]!.detail).toContain("Find row with maximum 1's");
  });

  it('reports a blocked logged-in page and falls back to the public page', async () => {
    const { fetchTufPotd } = await import('../src/agents/potd/tuf');
    const { readTufDiagnostics } = await import('../src/lib/tufDiagnostics');
    const p = await fetchTufPotd(1, page({ status: 403, text: '<html>Just a moment...</html>' }), page());
    expect(p.solved).toBe(false);
    const [run] = await readTufDiagnostics();
    expect(run!.result!.attempt).toBe('public');
    expect(run!.stages[0]).toMatchObject({ attempt: 'logged-in', stage: 'request', ok: false, status: 403, error: 'access blocked (HTTP 403)' });
    expect(run!.stages[1]).toMatchObject({ attempt: 'public', stage: 'request', ok: true, status: 200 });
  });

  it('names the failing stage when both reads fail, and never stores page bodies', async () => {
    const { fetchTufPotd } = await import('../src/agents/potd/tuf');
    const { readTufDiagnostics } = await import('../src/lib/tufDiagnostics');
    const loginRedirect = page({ url: 'https://takeuforward.org/login', text: '<html>sign in secret-token-xyz</html>' });
    const noData = page({ text: '<html><body>maintenance</body></html>' });
    await expect(fetchTufPotd(1, loginRedirect, noData)).rejects.toThrow(
      /logged-in page: request failed \(HTTP 200\): redirected to \/login · public page: load failed: .*page data not found/,
    );
    const [run] = await readTufDiagnostics();
    expect(run!.ok).toBe(false);
    expect(JSON.stringify(run)).not.toContain('secret-token-xyz');
    expect(JSON.stringify(run)).not.toContain('maintenance');
  });

  it('detects bot challenges and access blocks without retrying around them', async () => {
    const { looksBlocked } = await import('../src/agents/potd/tuf');
    const base = { status: 200, text: '<html></html>', url: 'https://takeuforward.org/potd' };
    expect(looksBlocked(base)).toBeNull();
    expect(looksBlocked({ ...base, status: 429 })).toBe('access blocked (HTTP 429)');
    expect(looksBlocked({ ...base, text: '<script src="/cdn-cgi/challenge-platform/x"></script>' })).toBe('blocked by a bot challenge page');
    expect(looksBlocked({ ...base, url: 'https://takeuforward.org/login' })).toBe('redirected to /login');
  });
});
