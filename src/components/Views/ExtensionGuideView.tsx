import React from 'react';
import {
  Puzzle,
  Download,
  CalendarCheck,
  Trophy,
  BarChart3,
  Cpu,
  ShieldCheck,
  Settings,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

const DOWNLOAD_URL =
  'https://github.com/Aman-kumar-git12/MakePatternDev/releases/latest/download/coding-journey-extension.zip';
const RELEASES_URL = 'https://github.com/Aman-kumar-git12/MakePatternDev/releases/latest';

const FEATURES = [
  {
    icon: CalendarCheck,
    color: '#facc15',
    title: 'Daily problems in one place',
    points: [
      'LeetCode daily challenge, GeeksforGeeks POTD, Striver’s takeUforward POTD and Newton School’s Question of the Day.',
      'Each one ticks itself off once you solve it.',
      'The LeetCode link is the official daily link, so it counts towards your LeetCode streak.',
    ],
  },
  {
    icon: Trophy,
    color: '#60a5fa',
    title: 'Never miss a contest',
    points: [
      'Upcoming contests from LeetCode, Codeforces, CodeChef and AtCoder with a live countdown.',
      'Reminders 60 and 10 minutes before each contest (you can change the times).',
      'One-click “Add to Google Calendar”.',
    ],
  },
  {
    icon: BarChart3,
    color: '#34d399',
    title: 'Your stats across every platform',
    points: [
      'Time spent coding per platform and per problem, against a daily goal. Only counts while you are active.',
      'Solved, accepted and wrong counts, a heatmap, streaks, weakest topics and a revisit list.',
      'View all platforms together or one at a time.',
    ],
  },
  {
    icon: Cpu,
    color: '#c084fc',
    title: 'Code analysis',
    points: [
      'Paste a solution into the built-in editor for an instant, offline complexity estimate and pattern detection.',
      'Optional AI review of time and space complexity, and how to do better, using your own free API key (Groq, Gemini and others).',
      'Analyse your recent LeetCode submissions with one click.',
    ],
  },
];

const PLATFORMS = ['LeetCode', 'Codeforces', 'CodeChef', 'AtCoder', 'GeeksforGeeks', 'takeUforward', 'Newton School'];

const INSTALL_STEPS: React.ReactNode[] = [
  <>
    Download <strong>coding-journey-extension.zip</strong> using the button above.
  </>,
  <>
    Unzip it. You get one folder, <code>coding-journey-extension</code>. Keep it somewhere permanent: the browser loads the
    extension from this folder.
  </>,
  <>
    Open <code>chrome://extensions</code> (Edge: <code>edge://extensions</code>) and turn on <strong>Developer mode</strong>{' '}
    in the top right.
  </>,
  <>
    Click <strong>Load unpacked</strong> and choose the <code>coding-journey-extension</code> folder.
  </>,
  <>
    Pin <strong>Coding Journey</strong> from the puzzle-piece menu in the toolbar, then open its <strong>Settings</strong>.
  </>,
];

const SETUP_STEPS: React.ReactNode[] = [
  <>
    <strong>Add your usernames</strong> for LeetCode, Codeforces, CodeChef, AtCoder, GeeksforGeeks and takeUforward. Each is
    optional; stats load only for the ones you fill in.
  </>,
  <>
    <strong>Stay logged in to leetcode.com</strong> in the same browser to get your full LeetCode history, with code.
  </>,
  <>
    <strong>Pick what to show:</strong> contest platforms, problem-of-the-day sources, reminder times and your daily coding goal.
  </>,
  <>
    <strong>Click the toolbar icon</strong> any time. The popup has four tabs: Daily, Contests, Stats and Analysis.
  </>,
];

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="mp-card p-5 sm:p-6">
      <h2 className="text-base font-bold flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-yellow-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
          <span className="w-6 h-6 shrink-0 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-500 text-[11px] font-bold flex items-center justify-center">
            {i + 1}
          </span>
          <span className="mp-muted pt-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[var(--bg-surface)] [&_strong]:text-[var(--text-primary)]">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** How to install and use the Coding Journey browser extension, and what it gives you. */
export const ExtensionGuideView: React.FC = () => {
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* Intro */}
      <section className="mp-card p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-[#fef08a] text-[#18181b] flex items-center justify-center shadow-md shadow-yellow-200/30">
            <Puzzle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider mp-faint">Browser extension</div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Coding Journey</h1>
            <p className="text-sm mp-muted mt-1.5 max-w-2xl leading-relaxed">
              Contests, problems of the day, coding time, submission stats and code analysis for every platform you practise
              on, in one popup. It's free, and everything stays in your browser.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a href={DOWNLOAD_URL} className="mp-btn mp-btn-primary py-2.5 px-4" rel="noopener noreferrer">
            <Download className="w-4 h-4" /> Download extension (.zip)
          </a>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="mp-btn py-2.5 px-4">
            Release notes <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="text-[11px] mp-faint">Chrome, Edge, Brave and other Chromium browsers</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <span key={p} className="mp-chip">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section>
        <h2 className="text-base font-bold px-1 mb-3">What you get</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, color, title, points }) => (
            <div key={title} className="mp-card p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}22`, color }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold">{title}</h3>
              </div>
              <ul className="space-y-2">
                {points.map((point) => (
                  <li key={point} className="flex gap-2 text-xs mp-muted leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Install */}
      <Section title="How to install" icon={Download}>
        <Steps steps={INSTALL_STEPS} />
        <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex gap-2.5 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="mp-muted">
            Don't drag the .zip onto the extensions page or select the zip itself. The extension isn't on the Chrome Web Store
            yet, so Chrome only accepts it as an unzipped folder through <strong>Load unpacked</strong>.
          </span>
        </div>
      </Section>

      {/* Use */}
      <Section title="How to use it" icon={Settings}>
        <Steps steps={SETUP_STEPS} />
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Updating" icon={RefreshCw}>
          <p className="text-xs mp-muted leading-relaxed">
            Download the new zip, replace the <code className="font-mono">coding-journey-extension</code> folder with the new one,
            then click the reload icon on the extension's card in <code className="font-mono">chrome://extensions</code>. Your data
            is kept.
          </p>
        </Section>
        <Section title="Your data stays with you" icon={ShieldCheck}>
          <p className="text-xs mp-muted leading-relaxed">
            No MakePattern server is involved. Settings, stats and submissions are stored on your device, and the extension talks
            only to the coding sites themselves. You can export or clear everything from its Settings page.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default ExtensionGuideView;
