import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  format,
  parseISO,
  subDays,
} from 'date-fns';
import { HEATMAP_COLORS, HABIT_DEFINITIONS } from '../../constants/habits';
import { useBreakpoint } from '../../hooks/useBreakpoint';

function countCompleted(habitDoc) {
  if (!habitDoc) return 0;
  return HABIT_DEFINITIONS.filter((h) => habitDoc[h.key]).length;
}

export default function HabitHeatmap({
  history,
  loading,
  compact = false,
  title,
}) {
  const [tooltip, setTooltip] = useState(null);
  const breakpoint = useBreakpoint();
  const daysBack = breakpoint === 'mobile' ? 29 : 89;
  const defaultTitle =
    breakpoint === 'mobile'
      ? 'Activity — last 30 days'
      : 'Activity — last 90 days';
  const displayTitle = title ?? defaultTitle;

  const { days, byDate } = useMemo(() => {
    const end = new Date();
    const start = subDays(end, daysBack);
    const intervalDays = eachDayOfInterval({ start, end });

    const map = {};
    (history || []).forEach((doc) => {
      if (doc?.date) map[doc.date] = doc;
    });

    return {
      days: intervalDays.map((d) => format(d, 'yyyy-MM-dd')),
      byDate: map,
    };
  }, [history, daysBack]);

  if (loading) {
    return (
      <p className="font-body text-sm text-gray-500">Loading activity...</p>
    );
  }

  return (
    <div className="habit-heatmap overflow-hidden">
      <h2
        className={
          compact
            ? 'font-body text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'
            : 'font-handwriting text-2xl text-gray-800 mb-3'
        }
      >
        {displayTitle}
      </h2>
      <div className="heatmap-grid flex flex-wrap gap-1">
        {days.map((dateStr) => {
          const count = countCompleted(byDate[dateStr]);
          const color = HEATMAP_COLORS[count] || HEATMAP_COLORS[0];
          const label = format(parseISO(dateStr), 'MMM d');

          return (
            <div
              key={dateStr}
              className="heatmap-cell"
              style={{ backgroundColor: color }}
              onMouseEnter={() =>
                setTooltip(`${label} — ${count}/6 habits`)
              }
              onMouseLeave={() => setTooltip(null)}
              title={`${label} — ${count}/6 habits`}
            />
          );
        })}
      </div>
      {tooltip && (
        <p className="font-body mt-2 text-sm text-gray-600">{tooltip}</p>
      )}
      <div className="font-body mt-3 flex items-center gap-2 text-xs text-gray-500">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className="heatmap-legend-swatch"
            style={{ backgroundColor: HEATMAP_COLORS[n] }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
