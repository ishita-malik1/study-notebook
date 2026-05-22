import { format } from 'date-fns';
import LoadingLine from '../layout/LoadingLine';
import StepScoreBars from '../review/StepScoreBars';
import { useDailySummary } from '../../hooks/useDailySummary';
import {
  getHabitRows,
  getHabitSummaryMessage,
} from '../../utils/dailySummaryUtils';
import { getBandStyle, formatProblemType } from '../../utils/scoringDisplay';

export default function DailySummaryOverlay({ onClose }) {
  const {
    loading,
    error,
    todayHabits,
    todaySession,
    reminders,
    tomorrowFocus,
    focusLoading,
    reload,
  } = useDailySummary(true);

  const todayLabel = format(new Date(), 'EEEE, MMM d');
  const habitRows = getHabitRows(todayHabits);
  const habitSummary = getHabitSummaryMessage(habitRows);

  return (
    <div
      className="daily-summary-overlay fixed inset-0 z-[80] overflow-y-auto"
      style={{ backgroundColor: '#fdf8f0' }}
    >
      <div
        className="absolute inset-0 pointer-events-none notebook-page-content opacity-40"
        aria-hidden
      />
      <div className="relative max-w-2xl mx-auto px-4 tablet:px-8 py-8 font-body min-h-full">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 tablet:right-8 text-2xl text-gray-500 hover:text-gray-800"
          aria-label="Close"
        >
          ✕
        </button>

        <header className="mb-8 pr-10">
          <h1 className="font-handwriting text-3xl text-gray-800">
            {todayLabel} — Daily Review
          </h1>
        </header>

        {loading && (
          <div className="py-12">
            <LoadingLine />
          </div>
        )}

        {error && !loading && (
          <div className="error-sticky-note mb-6">
            <p className="text-gray-800 mb-3">{error}</p>
            <button type="button" onClick={reload} className="case-btn-primary text-sm">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Habits Today</h2>
              <ul className="space-y-2">
                {habitRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-2 text-gray-800">
                    <span aria-hidden>{row.done ? '✅' : '❌'}</span>
                    <span>
                      {row.icon} {row.name}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-gray-700">
                You completed {habitSummary.completed}/6 habits today
              </p>
              <p className="text-sm text-gray-600 mt-1">{habitSummary.message}</p>
            </section>

            {todaySession && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Practice Today</h2>
                <p className="text-gray-800">
                  {todaySession.type === 'tpm' ? 'TPM Case' : 'Product Case'} —{' '}
                  {formatProblemType(todaySession.caseMetadata?.problemType) ||
                    'Practice'}
                </p>
                <p className="mt-1 font-medium" style={{ color: getBandStyle(todaySession.band).color }}>
                  {todaySession.scores?.overall?.toFixed(1)} / 5 — {todaySession.band || 'Developing'}
                </p>
                <div className="mt-3 max-w-md">
                  <StepScoreBars scores={todaySession.scores} />
                </div>
                {todaySession.feedback?.keyLearnings?.length > 0 && (
                  <ul className="mt-4 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {todaySession.feedback.keyLearnings.slice(0, 2).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {reminders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Keep These in Mind
                </h2>
                <ul className="list-disc pl-5 text-gray-700 space-y-2">
                  {reminders.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Tomorrow&apos;s Focus</h2>
              {focusLoading ? (
                <LoadingLine className="max-w-xs" />
              ) : (
                <p className="text-gray-800 italic leading-relaxed">{tomorrowFocus}</p>
              )}
            </section>

            <div className="pt-4 pb-8">
              <button type="button" onClick={onClose} className="case-btn-primary">
                Done for Today ✅
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
