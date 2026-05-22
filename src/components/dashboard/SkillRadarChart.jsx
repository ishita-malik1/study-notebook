import { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  getRadarData,
  getStrongestAndWeakest,
  computeStepAveragesFromSessions,
} from '../../utils/progressMetrics';
import { useBreakpoint, useChartHeight } from '../../hooks/useBreakpoint';

const CHART_FONT = 'Lato, system-ui, sans-serif';

const MOBILE_RADAR_LABELS = {
  step1: 'Clarify',
  step2: 'User',
  step3: 'Root Cause',
  step4: 'Prioritize',
  step5: 'Solution',
  step6: 'Metrics',
  step7: 'Risks',
  step8: 'Recommend',
};

const OUTER_RADIUS = {
  mobile: '58%',
  tablet: '68%',
  desktop: '75%',
};

export default function SkillRadarChart({ liveSessions }) {
  const breakpoint = useBreakpoint();
  const chartHeight = useChartHeight(260);
  const sessionCount = liveSessions.length;

  if (sessionCount < 3) {
    return (
      <div className="progress-panel rounded-lg border border-[#e8dcc8] bg-white/80 p-5 shadow-sm h-full flex items-center justify-center min-h-[220px] tablet:min-h-[260px]">
        <p className="font-body text-sm text-gray-500 text-center px-4">
          Complete 3+ sessions to see your skill radar
        </p>
      </div>
    );
  }

  const chartData = useMemo(() => {
    const rawData = getRadarData(liveSessions);
    return rawData.map((row) => ({
      ...row,
      step:
        breakpoint === 'mobile'
          ? MOBILE_RADAR_LABELS[row.stepId] || row.step
          : row.fullName || row.step,
    }));
  }, [liveSessions, breakpoint]);
  const averages = computeStepAveragesFromSessions(liveSessions);
  const { strongest, weakest } = getStrongestAndWeakest(averages);
  const outerRadius = OUTER_RADIUS[breakpoint] || OUTER_RADIUS.desktop;
  const tickSize = breakpoint === 'mobile' ? 9 : 11;

  return (
    <div className="progress-panel rounded-lg border border-[#e8dcc8] bg-white/80 p-5 shadow-sm h-full overflow-hidden">
      <h3 className="font-body text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Framework Skills
      </h3>
      <div
        className="w-full max-w-full overflow-hidden"
        style={{ background: '#fdf8f0', height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={outerRadius}>
            <PolarGrid stroke="#c5d0e6" />
            <PolarAngleAxis
              dataKey="step"
              tick={{ fontSize: tickSize, fill: '#4b5563', fontFamily: CHART_FONT }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tickCount={6}
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: CHART_FONT }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#4a90d9"
              fill="#4a90d9"
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {strongest && weakest && (
        <p className="font-body mt-3 text-sm text-gray-600">
          Strongest: <span className="font-medium">{strongest.name}</span> — Needs
          work: <span className="font-medium">{weakest.name}</span>
        </p>
      )}
    </div>
  );
}
