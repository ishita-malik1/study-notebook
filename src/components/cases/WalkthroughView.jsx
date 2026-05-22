import StickyNote from './StickyNote';
import ConversationThread from './ConversationThread';
import LoadingLine from '../layout/LoadingLine';

export default function WalkthroughView({
  walkthroughCase,
  practiceCase,
  loading,
  error,
  onRetry,
  onStartPractice,
  onSaveToReviewBank,
  saving,
  saved,
}) {
  if (loading) {
    return (
      <div className="case-loading flex flex-col items-center justify-center py-20">
        <LoadingLine />
        <p className="font-body mt-4 text-lg text-gray-600">
          Preparing your case study...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-error text-center py-12">
        <p className="font-body text-gray-700">
          Couldn&apos;t load case — try again
        </p>
        <button type="button" onClick={onRetry} className="case-btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  if (!walkthroughCase) return null;

  return (
    <div className="case-walkthrough mt-4 pb-8">
      <StickyNote tilt className="mb-6">
        <p className="font-body text-sm font-semibold text-amber-900/70 mb-1">
          Case Prompt — {walkthroughCase.company} ({walkthroughCase.domain})
        </p>
        <p className="font-body text-base leading-relaxed">
          {walkthroughCase.problemStatement}
        </p>
      </StickyNote>

      <ConversationThread conversation={walkthroughCase.conversation} />

      {practiceCase && (
        <div className="mt-10 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-6">
          <p className="font-body text-lg font-semibold text-emerald-800">
            Practice Case Unlocked 🎯
          </p>
          <StickyNote tilt className="mt-4">
            <p className="font-body text-sm font-semibold text-amber-900/70 mb-1">
              Your practice case — {practiceCase.company} ({practiceCase.domain})
            </p>
            <p className="font-body text-base leading-relaxed">
              {practiceCase.problemStatement}
            </p>
          </StickyNote>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStartPractice}
              className="case-btn-primary"
            >
              Start My Practice Session
            </button>
            <button
              type="button"
              onClick={onSaveToReviewBank}
              disabled={saving || saved}
              className="case-btn-secondary"
            >
              {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save to Review Bank'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
