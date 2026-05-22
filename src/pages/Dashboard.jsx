import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/layout/PageHeading';
import { fetchProgress } from '../services/progressApi';
import LevelPanel from '../components/dashboard/LevelPanel';
import SkillRadarChart from '../components/dashboard/SkillRadarChart';
import ScoreOverTimeChart from '../components/dashboard/ScoreOverTimeChart';
import StreakStatsTable from '../components/dashboard/StreakStatsTable';
import HabitHeatmap from '../components/habits/HabitHeatmap';
import LoadingLine from '../components/layout/LoadingLine';
import DailySummaryOverlay from '../components/daily/DailySummaryOverlay';
import { getLiveSessions } from '../utils/progressMetrics';
import { isAfterFivePm } from '../utils/dailySummaryUtils';

function SectionDivider() {
  return (
    <hr
      className="my-8 border-0 h-px w-full"
      style={{
        background:
          'repeating-linear-gradient(to right, transparent, transparent 4px, #c5d0e6 4px, #c5d0e6 8px)',
      }}
    />
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const showEndDay = isAfterFivePm();

  useEffect(() => {
    fetchProgress()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="progress-page">
        <PageHeading>My Progress</PageHeading>
        <div className="mt-8 max-w-xs">
          <LoadingLine />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-page">
        <PageHeading>My Progress</PageHeading>
        <p className="font-body text-red-600 mt-6">{error}</p>
      </div>
    );
  }

  const liveSessions = getLiveSessions(data?.sessions);
  const liveCount = liveSessions.length;
  const sessionsTotal = data?.learningProfile?.sessions_total ?? 0;
  const showEmpty = sessionsTotal === 0 && liveCount === 0;

  if (showEmpty) {
    return (
      <div className="progress-page">
        <PageHeading>My Progress</PageHeading>
        <div className="mt-12 text-center font-body">
          <p className="text-lg text-gray-700 max-w-md mx-auto">
            Nothing here yet — complete your first case session to start tracking
            progress.
          </p>
          <Link to="/product-case" className="case-btn-primary inline-block mt-6">
            Start a Case →
          </Link>
        </div>
      </div>
    );
  }

  const showTrendPlaceholder = liveCount < 2;

  return (
    <div className="progress-page pb-10">
      <PageHeading>My Progress</PageHeading>

      {showEndDay && (
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          className="desktop:hidden w-full mt-4 py-3 rounded-lg font-body text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#2c2c2c' }}
        >
          <span className="text-[#f4a261]">End My Day</span>
        </button>
      )}

      <section className="mt-6">
        <h2 className="font-handwriting text-2xl text-gray-800 mb-4">
          Where You Stand Today
        </h2>
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          <LevelPanel
            learningProfile={data.learningProfile}
            liveSessionCount={liveCount}
          />
          <SkillRadarChart liveSessions={liveSessions} />
        </div>
      </section>

      <SectionDivider />

      <section>
        {showTrendPlaceholder ? (
          <div>
            <h3 className="font-body text-lg font-semibold text-gray-800 mb-4">
              Score Over Time
            </h3>
            <p className="font-body text-sm text-gray-500 py-6 text-center">
              2 more sessions to unlock your trend chart
            </p>
          </div>
        ) : (
          <ScoreOverTimeChart liveSessions={liveSessions} />
        )}
      </section>

      <SectionDivider />

      <section>
        <h2 className="font-handwriting text-2xl text-gray-800 mb-4">
          Habits &amp; Consistency
        </h2>
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          <div className="progress-panel rounded-lg border border-[#e8dcc8] bg-white/80 p-5 shadow-sm overflow-hidden">
            <HabitHeatmap
              history={data.habits}
              loading={false}
              compact
              title="Habit activity — last 90 days"
            />
          </div>
          <StreakStatsTable
            streaks={data.streaks}
            habits={data.habits}
            sessions={data.sessions}
          />
        </div>
      </section>

      {summaryOpen && (
        <DailySummaryOverlay onClose={() => setSummaryOpen(false)} />
      )}
    </div>
  );
}
