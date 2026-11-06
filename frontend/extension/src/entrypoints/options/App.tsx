import { AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, Loader2, Play, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { weeklySummary } from '../../agents/coach';
import { AGENTS } from '../../agents/registry';
import { importStatus } from '../../components/importStatus';
import { Button, Card, cx, IconButton, PlatformIcon, platformVars } from '../../components/ui';
import { useNow, useStorage } from '../../hooks/useStorage';
import { agentBaseUrl, checkAgentHealth, PROVIDERS, providerById, TIER_LABEL, type ProviderTier } from '../../lib/complexityAgent';
import { send } from '../../lib/messages';
import { PLATFORMS } from '../../lib/platforms';
import { getItem, setItem } from '../../lib/storage';
import { relativeAgo } from '../../lib/time';
import type { ContestPlatform, PotdSource, Settings, Submission } from '../../lib/types';

const POTD_LABEL: Record<PotdSource, string> = {
  leetcode: 'LeetCode daily challenge',
  gfg: 'GeeksforGeeks problem of the day',
  tuf: "takeUforward (Striver) problem of the day",
  newton: 'Newton School Question of the Day (updates when you open its page)',
};

type HandleKey = keyof Settings['handles'];
const HANDLE_KEYS: HandleKey[] = ['codeforces', 'leetcode', 'codechef', 'atcoder', 'gfg', 'tuf'];
/** Handles whose submission history is imported (and purged when the handle changes). */
const IMPORTED: HandleKey[] = ['codeforces', 'leetcode', 'codechef', 'atcoder', 'gfg'];

// ---- Numeric fields: edited as text, validated on blur and on save -------------------

type FieldKey = 'idle' | 'goal' | 'offsets';
type FieldText = Record<FieldKey, string>;
type Parsed = { ok: true; patch: Partial<Settings>; text: string; note?: string } | { ok: false; error: string };

const IDLE_MIN = 15;
const IDLE_MAX = 3600;
const GOAL_MIN = 1;
const GOAL_MAX = 1440;
const OFFSET_MAX = 1440;

const isWhole = (raw: string) => /^\d+$/.test(raw.trim());

function clampField(raw: string, min: number, max: number, unit: string, toPatch: (n: number) => Partial<Settings>): Parsed {
  if (!isWhole(raw)) return { ok: false, error: `Enter a whole number of ${unit} between ${min} and ${max}.` };
  const n = Number(raw.trim());
  const v = Math.min(max, Math.max(min, n));
  return { ok: true, patch: toPatch(v), text: String(v), note: v !== n ? `Adjusted to ${v} — allowed range is ${min}–${max} ${unit}.` : undefined };
}

function parseField(key: FieldKey, raw: string, remindersEnabled: boolean): Parsed {
  switch (key) {
    case 'idle':
      return clampField(raw, IDLE_MIN, IDLE_MAX, 'seconds', (n) => ({ idleSeconds: n }));
    case 'goal':
      return clampField(raw, GOAL_MIN, GOAL_MAX, 'minutes', (n) => ({ dailyGoalMinutes: n }));
    case 'offsets': {
      const tokens = raw.split(/[,\s]+/).filter(Boolean);
      const bad = tokens.find((t) => !isWhole(t) || Number(t) < 1);
      if (bad) return { ok: false, error: `“${bad}” isn't a number of minutes (use whole numbers like 60, 10).` };
      const nums = tokens.map(Number);
      if (nums.some((n) => n > OFFSET_MAX)) return { ok: false, error: `Reminders can be at most ${OFFSET_MAX} minutes (24 hours) before a contest.` };
      if (!nums.length && remindersEnabled) return { ok: false, error: 'Add at least one reminder time, or turn reminders off.' };
      const clean = [...new Set(nums)].sort((a, b) => b - a);
      const text = clean.join(', ');
      const changed = text !== tokens.join(', ');
      return { ok: true, patch: { reminderOffsets: clean }, text, note: changed && clean.length ? `Saved as ${text} (duplicates removed, largest first).` : undefined };
    }
  }
}

const textFrom = (s: Settings): FieldText => ({
  idle: String(s.idleSeconds),
  goal: String(s.dailyGoalMinutes),
  offsets: s.reminderOffsets.join(', '),
});

/** Order-independent JSON, so settings read back from storage compare equal to what we wrote. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
const sameSettings = (a: Settings | undefined, b: Settings | undefined) => stable(a) === stable(b);

/** Submissions imported for a platform (live LeetCode captures aren't tied to the handle). */
const importedCount = (subs: Submission[] | undefined, p: HandleKey) =>
  (subs ?? []).filter((x) => x.platform === p && x.source !== 'capture' && !(p === 'leetcode' && x.code && !x.source)).length;

const sameHandle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * How many submissions the background will drop on the next sync when this platform's handle
 * changes to `next` (mirrors the submission agent's purge rules).
 */
function purgeCount(subs: Submission[] | undefined, p: HandleKey, next: string, hasLeetCodeSession: boolean): number {
  const keepsNew = (x: Submission) => !!x.account && !!next.trim() && sameHandle(x.account, next);
  return (subs ?? []).filter((x) => {
    if (x.platform !== p) return false;
    if (p !== 'leetcode') return !keepsNew(x);
    // LeetCode: the handle only feeds the public accepted-only import.
    if (x.source === 'api') return !keepsNew(x);
    return !x.source && !hasLeetCodeSession;
  }).length;
}

export function App() {
  const stored = useStorage('settings');
  const subs = useStorage('submissions');
  const agentStatus = useStorage('agentStatus');
  const cursors = useStorage('cursors');
  const hasLcSession = !!cursors?.leetcodeSession;
  const now = useNow(15_000);
  const [s, setS] = useState<Settings>();
  /** The stored settings the draft started from. */
  const [base, setBase] = useState<Settings>();
  const [text, setText] = useState<FieldText>({ idle: '', goal: '', offsets: '' });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [notes, setNotes] = useState<Partial<Record<FieldKey, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [external, setExternal] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const load = (x: Settings) => {
    setS(x);
    setBase(x);
    setText(textFrom(x));
    setErrors({});
    setNotes({});
    setDirty(false);
    setExternal(false);
  };

  // Follow changes made elsewhere (another tab, the popup, the background) without clobbering edits.
  useEffect(() => {
    if (!stored) return;
    if (!s) load(stored);
    else if (sameSettings(stored, base)) return;
    else if (dirty) setExternal(true);
    else load(stored);
    // Only storage changes should trigger this; draft state is read at that moment.
  }, [stored]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!s || !base) return null;

  const update = (patch: Partial<Settings>) => {
    setS({ ...s, ...patch });
    setDirty(true);
    setSaved('idle');
  };

  const editText = (key: FieldKey, value: string) => {
    setText((t) => ({ ...t, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotes((n) => ({ ...n, [key]: undefined }));
    setDirty(true);
    setSaved('idle');
  };

  /** Validates one text field; on success writes its value into the draft and shows the normalised text. */
  const commit = (key: FieldKey, draft: Settings, remindersEnabled = draft.remindersEnabled): Settings | null => {
    const r = parseField(key, text[key], remindersEnabled);
    if (!r.ok) {
      setErrors((e) => ({ ...e, [key]: r.error }));
      return null;
    }
    setText((t) => ({ ...t, [key]: r.text }));
    setNotes((n) => ({ ...n, [key]: r.note }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    return { ...draft, ...r.patch };
  };
  const onBlur = (key: FieldKey) => {
    const next = commit(key, s);
    if (next) setS(next);
  };

  const toPurge = (p: HandleKey) => {
    const old = base.handles[p].trim();
    if (!IMPORTED.includes(p) || !old || sameHandle(old, s.handles[p])) return 0;
    return purgeCount(subs, p, s.handles[p], hasLcSession);
  };
  const changedHandles = IMPORTED.filter((p) => toPurge(p) > 0);

  const save = async () => {
    // Validate every text field against the current draft.
    let draft: Settings = s;
    let valid = true;
    for (const key of ['idle', 'goal', 'offsets'] as FieldKey[]) {
      const next = commit(key, draft);
      if (next) draft = next;
      else valid = false;
    }
    if (!valid) {
      setSaved('error');
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }
    try {
      agentBaseUrl(draft.agent.url);
    } catch (e) {
      setSaved('error');
      setSaveError((e as Error).message);
      return;
    }
    if (changedHandles.length) {
      const lines = changedHandles.map(
        (p) => `• ${PLATFORMS[p].name}: ${toPurge(p)} submissions imported for “${base.handles[p].trim()}”`,
      );
      const ok = confirm(
        `You changed or cleared a handle. The old account's imported data will be removed on the next sync:\n\n${lines.join('\n')}\n\nContinue?`,
      );
      if (!ok) return;
    }
    setSaved('saving');
    setSaveError('');
    const clean: Settings = {
      ...draft,
      handles: Object.fromEntries(HANDLE_KEYS.map((k) => [k, draft.handles[k].trim()])) as Settings['handles'],
      agent: {
        ...draft.agent,
        url: draft.agent.url.trim(),
        // Drop empty entries so cleared keys/models don't linger in storage.
        keys: Object.fromEntries(Object.entries(draft.agent.keys).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
        models: Object.fromEntries(Object.entries(draft.agent.models).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
      },
    };
    try {
      await setItem('settings', clean);
    } catch (e) {
      setSaved('error');
      setSaveError(`Couldn't save settings: ${(e as Error).message || 'unknown error'}`);
      return;
    }
    setBase(clean);
    setS(clean);
    setText(textFrom(clean));
    setDirty(false);
    setExternal(false);
    setSaved('saved');
    // Saved either way; the background only needs a nudge to refresh data.
    await send({ type: 'settingsChanged' }).catch(() => undefined);
  };

  const discard = () => load(stored ?? base);
  const fieldProps = (key: FieldKey) => ({
    value: text[key],
    onChange: (e: { target: { value: string } }) => editText(key, e.target.value),
    onBlur: () => onBlur(key),
    'aria-invalid': !!errors[key] || undefined,
    'aria-describedby': errors[key] || notes[key] ? `${key}-msg` : undefined,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-8 pb-24">
      <header className="flex items-center gap-3">
        <img src="/icon/48.png" alt="" className="h-9 w-9" />
        <div>
          <h1 className="text-lg font-semibold">Coding Journey settings</h1>
          <p className="text-xs text-ink-3">Everything is stored locally in your browser.</p>
        </div>
      </header>

      {external && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning-text)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning-text)_10%,var(--card))] px-3 py-2 text-sm"
        >
          <AlertTriangle size={16} className="shrink-0 text-warning-text" aria-hidden />
          <span className="min-w-0 flex-1">Settings were changed elsewhere. Reload to see them — this discards your unsaved edits here.</span>
          <Button onClick={discard}>Reload</Button>
        </div>
      )}

      <WeeklySummary />

      <Section
        title="Your handles"
        hint="Codeforces, LeetCode, CodeChef and AtCoder import your submissions and verdicts (LeetCode also captures them live while you code). GeeksforGeeks imports your solved problems, score and POTD streak. takeUforward is only used for your profile link."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {HANDLE_KEYS.map((p) => {
            const old = base.handles[p].trim();
            const cur = s.handles[p].trim();
            const count = IMPORTED.includes(p) ? importedCount(subs, p) : 0;
            const purge = toPurge(p);
            const st = importStatus(agentStatus?.submissions, p);
            const inputId = `handle-${p}`;
            return (
              <div key={p} className="plat-stripe plat-tint rounded-lg border border-line py-2 pr-2 pl-3" style={platformVars(p)}>
                <div className="flex items-center gap-2.5">
                  <PlatformIcon platform={p} size={26} />
                  <span className="min-w-0 flex-1">
                    <label htmlFor={inputId} className="mb-0.5 block text-xs font-semibold">
                      {PLATFORMS[p].name}
                    </label>
                    <input
                      id={inputId}
                      className="input"
                      value={s.handles[p]}
                      placeholder={`${PLATFORMS[p].name} username`}
                      aria-describedby={`${inputId}-status`}
                      onChange={(e) => update({ handles: { ...s.handles, [p]: e.target.value } })}
                    />
                  </span>
                </div>
                <p id={`${inputId}-status`} className="mt-1 text-[11px] text-ink-2">
                  {p === 'tuf' ? (
                    'Used for your profile link; takeUforward has no public API for importing history.'
                  ) : purge > 0 ? (
                    <span className="text-warning-text">
                      {cur ? 'Changing' : 'Clearing'} this removes the {purge} submission{purge === 1 ? '' : 's'} imported for “{old}” on the next sync.
                    </span>
                  ) : !old && p !== 'leetcode' ? (
                    'Not connected'
                  ) : st.running ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" aria-hidden /> Importing {PLATFORMS[p].name}…
                    </span>
                  ) : st.error ? (
                    <span className="text-critical">Last import failed: {st.error}</span>
                  ) : st.lastRun ? (
                    `${count} imported · last synced ${relativeAgo(st.lastRun, now)}`
                  ) : (
                    'Waiting for the first sync'
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">HackerRank and Code360 have no public history API, so only your coding time there is tracked.</p>
      </Section>

      <Section title="Contests" hint="Platforms shown in the contest list and badge.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(s.contestPlatforms) as ContestPlatform[]).map((p) => (
            <label
              key={p}
              style={platformVars(p)}
              className={cx(
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border py-1.5 pr-3 pl-1.5 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]',
                s.contestPlatforms[p] ? 'plat-tint plat-border' : 'border-line text-ink-2',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={s.contestPlatforms[p]}
                onChange={(e) => update({ contestPlatforms: { ...s.contestPlatforms, [p]: e.target.checked } })}
              />
              <PlatformIcon platform={p} size={18} className={s.contestPlatforms[p] ? undefined : 'grayscale'} />
              {PLATFORMS[p].name}
              <span className="text-[11px] text-ink-3">{s.contestPlatforms[p] ? 'On' : 'Off'}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Check
            label="Remind me before every contest (you can mute single contests with the bell)"
            checked={s.remindersEnabled}
            onChange={(v) => {
              update({ remindersEnabled: v });
              // Re-check offsets: an empty list is only valid with reminders off.
              if (errors.offsets || !v) setErrors((e) => ({ ...e, offsets: undefined }));
            }}
          />
          <Field label="Remind me this many minutes before (comma separated, up to 1440)" htmlFor="offsets">
            <input id="offsets" className="input max-w-48" inputMode="numeric" {...fieldProps('offsets')} />
          </Field>
          <FieldMessage id="offsets-msg" error={errors.offsets} note={notes.offsets} />
        </div>
      </Section>

      <Section title="Problems of the day">
        <div className="space-y-2">
          {(Object.keys(POTD_LABEL) as PotdSource[]).map((p) => (
            <Check
              key={p}
              label={
                <span className="inline-flex items-center gap-2">
                  <PlatformIcon platform={p} size={18} />
                  {POTD_LABEL[p]}
                </span>
              }
              checked={s.potdSources[p]}
              onChange={(v) => update({ potdSources: { ...s.potdSources, [p]: v } })}
            />
          ))}
        </div>
      </Section>

      <Section title="Time tracking & goals">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Field label={`Daily coding goal (minutes, ${GOAL_MIN}–${GOAL_MAX})`} htmlFor="goal">
              <input id="goal" className="input" inputMode="numeric" {...fieldProps('goal')} />
            </Field>
            <FieldMessage id="goal-msg" error={errors.goal} note={notes.goal} />
          </div>
          <div>
            <Field label={`Stop counting after this many seconds without input (${IDLE_MIN}–${IDLE_MAX})`} htmlFor="idle">
              <input id="idle" className="input" inputMode="numeric" {...fieldProps('idle')} />
            </Field>
            <FieldMessage id="idle-msg" error={errors.idle} note={notes.idle} />
          </div>
        </div>
        <Check className="mt-3" label="Send a weekly progress report on Sunday evening" checked={s.weeklyReport} onChange={(v) => update({ weeklyReport: v })} />
      </Section>

      <ComplexityAgentSection agent={s.agent} onChange={(agent) => update({ agent })} />

      <AgentsPanel />
      <DataPanel />

      {(dirty || saved !== 'idle') && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 shadow-[0_-4px_14px_rgb(0_0_0/0.08)] backdrop-blur"
          role="region"
          aria-label="Save settings"
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1" role="status">
              {saved === 'saving' ? (
                'Saving…'
              ) : saved === 'error' ? (
                <span className="text-critical">{saveError}</span>
              ) : saved === 'saved' && !dirty ? (
                <span className="text-good-text">✓ Saved — refreshing data</span>
              ) : (
                'You have unsaved changes'
              )}
            </span>
            {dirty && (
              <Button variant="ghost" onClick={discard} disabled={saved === 'saving'}>
                Discard
              </Button>
            )}
            {(dirty || saved === 'error') && (
              <Button variant="primary" className="px-4 py-2 text-sm" onClick={() => void save()} disabled={saved === 'saving'}>
                {saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Retry save' : 'Save settings'}
              </Button>
            )}
          </div>
        </div>
      )}

      <style>{`.input{width:100%;border:1px solid var(--border);background:var(--surface-2);border-radius:8px;padding:6px 8px;font-size:13px;color:var(--text)}.input:focus{border-color:var(--accent)}.input[aria-invalid=true]{border-color:var(--critical)}`}</style>
    </div>
  );
}

const TIERS: ProviderTier[] = ['free', 'paid', 'local'];

function ComplexityAgentSection({ agent, onChange }: { agent: Settings['agent']; onChange: (a: Settings['agent']) => void }) {
  const provider = providerById(agent.provider) ?? PROVIDERS[0]!;
  const [showKey, setShowKey] = useState(false);
  const [health, setHealth] = useState<'idle' | 'checking' | 'ok' | 'down' | 'bad-url'>('idle');
  const test = async () => {
    try {
      agentBaseUrl(agent.url);
    } catch {
      setHealth('bad-url');
      return;
    }
    setHealth('checking');
    setHealth((await checkAgentHealth(agent.url)) ? 'ok' : 'down');
  };
  return (
    <Section
      title="AI code review"
      hint="Optional. The AI review talks only about complexity: time and space, why, and whether a faster approach exists. Run the agent folder (python app.py), pick a provider (free ones like Groq or Gemini work) and paste your own API key. Keys stay in this browser, are never exported, and are sent only to the agent URL below."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Agent URL" htmlFor="agent-url">
          <div className="flex gap-2">
            <input
              id="agent-url"
              className="input min-w-0 flex-1"
              inputMode="url"
              spellCheck={false}
              value={agent.url}
              onChange={(e) => {
                setHealth('idle');
                onChange({ ...agent, url: e.target.value });
              }}
            />
            <Button onClick={() => void test()} disabled={health === 'checking'}>
              {health === 'checking' ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              Test connection
            </Button>
          </div>
          <p id="agent-health" className="mt-1 text-xs" role="status">
            {health === 'ok' && (
              <span className="inline-flex items-center gap-1 text-good-text">
                <CheckCircle2 size={12} aria-hidden /> Agent is running
              </span>
            )}
            {health === 'down' && (
              <span className="inline-flex items-center gap-1 text-critical">
                <XCircle size={12} aria-hidden /> Not reachable — start it with <code>python app.py</code> in the agent folder
              </span>
            )}
            {health === 'bad-url' && <span className="text-critical">Enter an http:// or https:// URL.</span>}
          </p>
        </Field>
        <Field label="Provider" htmlFor="agent-provider">
          <select
            id="agent-provider"
            className="input"
            value={provider.id}
            onChange={(e) => {
              setShowKey(false);
              onChange({ ...agent, provider: e.target.value });
            }}
          >
            {TIERS.map((tier) => (
              <optgroup key={tier} label={TIER_LABEL[tier]}>
                {PROVIDERS.filter((p) => p.tier === tier).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {provider.needsKey ? (
          <Field label={`${provider.label} API key`} htmlFor="agent-key">
            <div className="flex gap-2">
              <input
                id="agent-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                className="input min-w-0 flex-1"
                placeholder="Paste your key"
                value={agent.keys[provider.id] ?? ''}
                onChange={(e) => onChange({ ...agent, keys: { ...agent.keys, [provider.id]: e.target.value } })}
              />
              <IconButton title={showKey ? 'Hide API key' : 'Show API key'} pressed={showKey} onClick={() => setShowKey((v) => !v)} className="h-auto">
                {showKey ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              </IconButton>
            </div>
            <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Get a {provider.label} key <ExternalLink size={11} aria-hidden />
            </a>
          </Field>
        ) : (
          <div className="text-xs text-ink-2 sm:self-center">
            No key needed — install{' '}
            <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Ollama
            </a>{' '}
            and pull the model first.
          </div>
        )}
        <Field label="Model (leave empty for the default)" htmlFor="agent-model">
          <input
            id="agent-model"
            className="input"
            spellCheck={false}
            placeholder={provider.defaultModel}
            value={agent.models[provider.id] ?? ''}
            onChange={(e) => onChange({ ...agent, models: { ...agent.models, [provider.id]: e.target.value } })}
          />
        </Field>
      </div>
    </Section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-ink-3">{hint}</p>}
      <div className={cx(!hint && 'mt-3')}>{children}</div>
    </Card>
  );
}

function Field({ label, children, className, htmlFor }: { label: string; children: ReactNode; className?: string; htmlFor: string }) {
  return (
    <div className={cx('block', className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldMessage({ id, error, note }: { id: string; error?: string; note?: string }) {
  if (!error && !note) return null;
  return (
    <p id={id} className={cx('mt-1 text-xs', error ? 'text-critical' : 'text-ink-2')} role={error ? 'alert' : undefined}>
      {error ?? note}
    </p>
  );
}

function Check({ label, checked, onChange, className }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function WeeklySummary() {
  const subs = useStorage('submissions');
  const [summary, setSummary] = useState<{ title: string; message: string }>();
  const scrolled = useRef(false);
  useEffect(() => {
    void weeklySummary().then(setSummary);
  }, [subs]);
  // The weekly-report notification links to #stats, but this card renders only after the
  // async summary loads, so the browser's own anchor jump has nothing to land on: scroll now.
  useEffect(() => {
    if (!summary || scrolled.current || location.hash !== '#stats') return;
    scrolled.current = true;
    requestAnimationFrame(() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [summary]);
  if (!summary) return null;
  return (
    <div id="stats" className="scroll-mt-4" tabIndex={-1}>
      <Card highlight className="p-4">
        <div className="text-xs font-semibold tracking-wide text-accent uppercase">Last 7 days</div>
        <div className="mt-1 text-base font-semibold">{summary.title}</div>
        <p className="mt-0.5 text-sm text-ink-2">{summary.message}</p>
      </Card>
    </div>
  );
}

function AgentsPanel() {
  const status = useStorage('agentStatus');
  const now = useNow(15000);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const run = async (id: string) => {
    setRunning((r) => ({ ...r, [id]: true }));
    await send({ type: 'runAgent', id }).catch(() => undefined);
    setRunning((r) => ({ ...r, [id]: false }));
  };
  return (
    <Section title="Agents" hint="Each agent is an independent background job. Scheduled agents run automatically; you can run any of them now.">
      <ul className="divide-y divide-[var(--border)]">
        {AGENTS.map((a) => {
          const st = status?.[a.id];
          const busy = running[a.id] || st?.running;
          return (
            <li key={a.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5" aria-hidden>
                {busy ? (
                  <Loader2 size={16} className="animate-spin text-accent" />
                ) : st?.ok === false ? (
                  <XCircle size={16} className="text-critical" />
                ) : st?.ok ? (
                  <CheckCircle2 size={16} className="text-good" />
                ) : (
                  <span className="block h-4 w-4 rounded-full border border-line" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {a.name}{' '}
                  <span className="text-xs font-normal text-ink-3">
                    · {a.trigger === 'schedule' ? `every ${a.periodMinutes! >= 60 ? `${a.periodMinutes! / 60}h` : `${a.periodMinutes}m`}` : a.trigger === 'event' ? 'on browser events' : 'on demand'}
                  </span>
                </div>
                <p className="text-xs text-ink-3">{a.description}</p>
                {st?.lastRun && (
                  <p className={cx('mt-1 text-xs', st.ok ? 'text-ink-2' : 'text-critical')}>
                    {relativeAgo(st.lastRun, now)} — {st.message}
                  </p>
                )}
              </div>
              <Button title={`Run ${a.name} now`} onClick={() => void run(a.id)} disabled={!!busy}>
                <Play size={12} aria-hidden /> Run
              </Button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function DataPanel() {
  const [error, setError] = useState('');
  const exportData = async () => {
    const all = await browser.storage.local.get(null);
    const settings = await getItem('settings');
    // Never export API keys.
    const data = { ...all, settings: { ...settings, agent: { ...settings.agent, keys: {} } } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coding-journey-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const clear = async () => {
    if (!confirm('Delete all tracked time, submissions, analyses and POTD history? Settings are kept.')) return;
    setError('');
    await send({ type: 'clearData' }).catch((e: Error) => setError(`Couldn't clear data: ${e.message}`));
  };
  return (
    <Section title="Your data">
      <div className="flex gap-2">
        <Button onClick={() => void exportData().catch((e: Error) => setError(`Couldn't export: ${e.message}`))}>Export as JSON</Button>
        <Button onClick={() => void clear()} className="text-critical">
          Clear tracked data
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-critical" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
