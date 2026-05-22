import { useState } from 'react';
import { format } from 'date-fns';
import NavTabs from './NavTabs';
import PageTransition from './PageTransition';
import ErrorBoundary from './ErrorBoundary';
import DailySummaryOverlay from '../daily/DailySummaryOverlay';
import { useStreaks } from '../../hooks/useStreaks';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { getTopStreakForStrip } from '../../utils/streakDisplay';
import { isAfterFivePm } from '../../utils/dailySummaryUtils';

const SPIRAL_RING_COUNTS = {
  mobile: 8,
  tablet: 12,
  desktop: 18,
};

export default function NotebookLayout() {
  const today = format(new Date(), 'EEEE, MMM d');
  const { streaks, loading: streaksLoading } = useStreaks();
  const breakpoint = useBreakpoint();
  const topStreak = streaksLoading
    ? 'Loading streaks...'
    : getTopStreakForStrip(streaks) || 'No active streaks yet';
  const [summaryOpen, setSummaryOpen] = useState(false);
  const showEndDay = isAfterFivePm();
  const ringCount = SPIRAL_RING_COUNTS[breakpoint] ?? SPIRAL_RING_COUNTS.desktop;

  return (
    <div className="min-h-screen flex flex-col bg-notebook-charcoal notebook-app-min">
      <div className="flex flex-1 flex-col min-h-screen min-h-[100dvh] w-full">
        <div className="flex flex-1 min-h-0">
          <div className="notebook-spiral-column flex-shrink-0 flex flex-col items-center justify-between py-3 tablet:py-4 desktop:py-6">
            {Array.from({ length: ringCount }).map((_, i) => (
              <div key={i} className="spiral-ring" />
            ))}
          </div>

          <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full">
            <div className="relative flex-1 flex flex-col min-h-0">
              <NavTabs />

              <div
                className="relative flex-1 overflow-auto"
                style={{ backgroundColor: '#fdf8f0' }}
              >
                <div className="notebook-margin-line" />
                <div className="notebook-page-content notebook-page-content--responsive relative mx-auto w-full max-w-[960px] min-h-full pb-4">
                  <ErrorBoundary>
                    <PageTransition />
                  </ErrorBoundary>
                </div>
              </div>
            </div>

            <div
              className="notebook-bottom-strip flex-shrink-0 flex flex-col tablet:flex-row items-start tablet:items-center gap-1 tablet:gap-0 px-3 tablet:px-6 py-2 tablet:py-0 text-white text-xs tablet:text-sm font-body"
              style={{ backgroundColor: '#2c2c2c' }}
            >
              <span className="notebook-bottom-strip-date tablet:flex-1 whitespace-nowrap">
                {today}
              </span>
              <span className="notebook-bottom-strip-streak tablet:flex-1 tablet:text-center opacity-90 truncate max-w-full">
                {topStreak}
              </span>
              <span className="hidden desktop:block desktop:flex-1 desktop:text-right">
                {showEndDay ? (
                  <button
                    type="button"
                    onClick={() => setSummaryOpen(true)}
                    className="end-day-btn font-medium text-[#f4a261] hover:text-[#ffc48a] transition-colors"
                  >
                    End My Day
                  </button>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </div>

      {summaryOpen && (
        <DailySummaryOverlay onClose={() => setSummaryOpen(false)} />
      )}
    </div>
  );
}
