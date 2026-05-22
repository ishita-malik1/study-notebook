import { FRAMEWORK_STEPS } from '../../constants/caseFramework';

const BAND_STYLES = {
  Weak: { color: '#ef4444', label: 'WEAK' },
  Developing: { color: '#f59e0b', label: 'DEVELOPING' },
  Strong: { color: '#22c55e', label: 'STRONG' },
  Exceptional: { color: '#6366f1', label: 'EXCEPTIONAL' },
};

export default function ScoringScreen({
  evaluation,
  hintUsed,
  onSave,
  onReviewWalkthrough,
  onBackHome,
  saving,
  saved,
}) {
  if (!evaluation) return null;

  const bandStyle = BAND_STYLES[evaluation.band] || BAND_STYLES.Developing;
  const covered = new Set(evaluation.stepsCovered || []);

  return (
    <div className="scoring-screen font-body pb-10">
      <section className="scoring-section text-center py-6">
        <p
          className="text-4xl font-bold tracking-wide"
          style={{ color: bandStyle.color }}
        >
          {bandStyle.label}
        </p>
        <p className="mt-2 text-2xl text-gray-800">
          {evaluation.scores?.overall ?? '—'} / 5
        </p>
        {hintUsed && (
          <p className="mt-1 text-sm text-amber-600">
            Includes −0.5 hint penalty
          </p>
        )}
      </section>

      <section className="scoring-section mt-6 space-y-3">
        <h3 className="font-semibold text-gray-800">Step-by-Step</h3>
        {FRAMEWORK_STEPS.map((step) => {
          const addressed = covered.has(step.id);
          const score = addressed ? evaluation.scores?.[step.id] ?? 0 : 0;
          const pct = (score / 5) * 100;

          return (
            <div
              key={step.id}
              className={[
                'flex items-center gap-3 rounded-lg border px-3 py-2',
                addressed ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-70',
              ].join(' ')}
            >
              <span className="scoring-step-row flex-1 text-sm text-gray-700 min-w-0 truncate">
                {step.name}
                {!addressed && (
                  <span className="ml-2 text-xs text-gray-400">Not addressed</span>
                )}
              </span>
              <div className="scoring-step-bar w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: addressed ? bandStyle.color : '#d1d5db',
                  }}
                />
              </div>
              <span className="w-8 text-right text-sm font-semibold text-gray-700">
                {score}
              </span>
            </div>
          );
        })}
      </section>

      <section className="scoring-section mt-8 grid grid-cols-1 gap-6 desktop:grid-cols-3">
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">✅ What You Did Well</h4>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            {(evaluation.feedback?.strengths || []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">🔧 What to Fix</h4>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            {(evaluation.feedback?.improvements || []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">💡 Key Learnings</h4>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            {(evaluation.feedback?.keyLearnings || []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="scoring-actions scoring-section mt-8 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className="case-btn-primary"
        >
          {saved ? 'Session Saved ✓' : saving ? 'Saving...' : 'Save Session'}
        </button>
        <button type="button" onClick={onReviewWalkthrough} className="case-btn-secondary">
          Review the Walkthrough Again
        </button>
        <button type="button" onClick={onBackHome} className="case-btn-secondary">
          Back to Home
        </button>
      </section>
    </div>
  );
}
