import { BarChart3, CalendarDays, Code2, ExternalLink, ListChecks, Settings } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { browser } from 'wxt/browser';
import { AnalyzeTab } from '../../components/AnalyzeTab';
import { CurrentPageBanner } from '../../components/CurrentPage';
import { ContestsTab } from '../../components/ContestsTab';
import { StatsTab } from '../../components/StatsTab';
import { TodayTab } from '../../components/TodayTab';
import { IconButton } from '../../components/ui';

/** The MakePattern web app, where users build and review their DSA patterns. */
const MAKEPATTERN_URL = 'https://make-pattern-dev.vercel.app/patterns';

// Order matters: what to solve today -> what's coming up -> how you're doing -> deep dives.
const TABS = [
  { id: 'today', label: 'Daily', icon: ListChecks },
  { id: 'contests', label: 'Contests', icon: CalendarDays },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'analyze', label: 'Analysis', icon: Code2 },
] as const;
type TabId = (typeof TABS)[number]['id'];

function loadTab(): TabId {
  try {
    const t = localStorage.getItem('tab');
    if (TABS.some((x) => x.id === t)) return t as TabId;
  } catch {
    /* storage unavailable */
  }
  return 'today';
}

export function App() {
  const [tab, setTab] = useState<TabId>(loadTab);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const select = (t: TabId) => {
    setTab(t);
    try {
      localStorage.setItem('tab', t);
    } catch {
      /* ignore */
    }
  };

  // WAI-ARIA tabs: arrows / Home / End move focus and select (automatic activation).
  const onTabKey = (e: KeyboardEvent<HTMLElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = TABS[next]!.id;
    select(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <div className="flex h-[580px] w-[400px] flex-col bg-surface">
      <header className="flex items-center gap-2.5 px-3.5 pt-3 pb-2.5">
        <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm" aria-hidden>
          <Code2 size={17} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] leading-tight font-extrabold tracking-tight">Coding Journey</h1>
          <p className="truncate text-[10.5px] text-ink-3">Your daily practice, contests &amp; progress</p>
        </div>
        <a
          href={MAKEPATTERN_URL}
          target="_blank"
          rel="noreferrer"
          className="brand-gradient inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand-1)] focus-visible:outline-none"
          title="Open your patterns on MakePattern"
        >
          MakePattern
          <ExternalLink size={11} aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <IconButton title="Settings" onClick={() => void browser.runtime.openOptionsPage()}>
          <Settings size={16} />
        </IconButton>
      </header>

      <div className="px-3">
        <CurrentPageBanner />
      </div>

      <div className="segmented mx-3 mt-2.5" role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            // Only the selected tab's panel is rendered, so only it can be referenced.
            aria-controls={tab === id ? `panel-${id}` : undefined}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => select(id)}
            className="inline-flex items-center justify-center gap-1.5"
          >
            <Icon size={13} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="scroll-thin relative flex-1 overflow-y-auto px-3 pt-3 pb-4"
      >
        {tab === 'today' && <TodayTab />}
        {tab === 'contests' && <ContestsTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'analyze' && <AnalyzeTab />}
      </main>
    </div>
  );
}
