import React from 'react';
import { ShimmerBlock } from './ShimmerBlock';

/** Title widths for the placeholder topic cards, so they don't look identical. */
const TOPIC_TITLE_WIDTHS = ['w-28', 'w-40', 'w-24', 'w-36', 'w-32'];

interface PatternsShimmerProps {
  /** How many placeholder topic cards to show. */
  topics?: number;
}

/**
 * Loading placeholder for the My Patterns page. Mirrors its layout (header card with stats and
 * inputs, then one card per topic) so nothing jumps when the real content arrives.
 */
export const PatternsShimmer: React.FC<PatternsShimmerProps> = ({ topics = 5 }) => (
  <div className="p-4 max-w-6xl mx-auto space-y-4" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading your patterns…</span>

    {/* Header card: title, description, action buttons, stat chips, search + quick-create inputs */}
    <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <ShimmerBlock className="h-5 w-5 rounded-md" />
            <ShimmerBlock className="h-5 w-56 max-w-[60vw]" />
          </div>
          <ShimmerBlock className="h-3 w-80 max-w-[75vw]" />
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-9 w-36 rounded-xl" />
          <ShimmerBlock className="h-9 w-28 rounded-xl" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
        {['w-28', 'w-36', 'w-20', 'w-20', 'w-20'].map((w, i) => (
          <ShimmerBlock key={i} className={`h-7 ${w} rounded-lg`} />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <ShimmerBlock className="h-8 flex-1 rounded-lg" />
        <ShimmerBlock className="h-8 flex-1 rounded-lg" />
        <ShimmerBlock className="h-8 w-14 rounded-lg hidden sm:block" />
      </div>
    </div>

    {/* Topic cards: drag handle, chevron, name, count chip | action buttons */}
    <div className="space-y-3">
      {Array.from({ length: topics }, (_, i) => (
        <div key={i} className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <ShimmerBlock className="h-4 w-3 rounded-sm hidden md:block" />
              <ShimmerBlock className="h-5 w-5 rounded-full" />
              <ShimmerBlock className={`h-4 ${TOPIC_TITLE_WIDTHS[i % TOPIC_TITLE_WIDTHS.length]}`} />
              <ShimmerBlock className="h-5 w-32 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <ShimmerBlock className="h-7 w-28 rounded-lg" />
              <ShimmerBlock className="h-7 w-28 rounded-lg" />
              <ShimmerBlock className="h-7 w-16 rounded-lg hidden sm:block" />
              <ShimmerBlock className="h-7 w-7 rounded-lg hidden sm:block" />
              <ShimmerBlock className="h-7 w-16 rounded-lg hidden sm:block" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default PatternsShimmer;
