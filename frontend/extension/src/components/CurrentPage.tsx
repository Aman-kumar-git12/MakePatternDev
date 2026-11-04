import { ExternalLink as LinkIcon, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { detectPage, PLATFORMS, prettyProblem, type DetectedPage } from '../lib/platforms';
import { PlatformIcon, platformVars } from './ui';

/** Which coding platform (and problem) the active tab is on. */
function useActivePage(): DetectedPage | null | undefined {
  const [page, setPage] = useState<DetectedPage | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => alive && setPage(detectPage(tab?.url)))
      .catch(() => alive && setPage(null));
    return () => {
      alive = false;
    };
  }, []);
  return page;
}

/**
 * Banner under the popup header, themed in the platform's colors, so it's obvious at a
 * glance which site the extension is looking at. Quiet neutral strip on other sites.
 */
export function CurrentPageBanner() {
  const page = useActivePage();
  if (page === undefined) return <div className="h-[50px]" aria-hidden />;

  if (!page) {
    return (
      <div className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-dashed border-line px-3 text-[11.5px] text-ink-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2">
          <Globe size={14} aria-hidden />
        </span>
        <span className="truncate">Open a problem on any coding site to track it here</span>
      </div>
    );
  }

  const p = PLATFORMS[page.platform];
  return (
    <div
      className="plat-hero flex h-[50px] items-center gap-2.5 rounded-2xl px-3"
      style={platformVars(page.platform)}
      role="status"
      aria-label={`Current tab: ${p.name}${page.problemKey ? `, ${prettyProblem(page.problemKey)}` : ''}`}
    >
      <PlatformIcon platform={page.platform} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--p)' }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--p)' }} />
          </span>
          You&apos;re on {p.name}
        </div>
        <div className="truncate text-[13.5px] leading-tight font-bold">
          {page.problemKey ? prettyProblem(page.problemKey) : 'Browsing · open a problem to track it'}
        </div>
      </div>
      <a
        href={p.home}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
        title={`Open ${p.name}`}
        aria-label={`Open ${p.name}`}
      >
        <LinkIcon size={14} aria-hidden />
      </a>
    </div>
  );
}
