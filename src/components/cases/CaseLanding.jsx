export default function CaseLanding({
  onStartWalkthrough,
  onStartPractice,
  onSkipToPractice,
  walkthroughDoneToday,
  loading,
}) {
  return (
    <div className="case-landing mt-6">
      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <div className="case-action-card rounded-lg border border-[#e8dcc8] bg-white/80 p-6 shadow-sm">
          <span className="text-3xl" aria-hidden>
            📖
          </span>
          <h2 className="font-body mt-3 text-xl font-semibold text-gray-800">
            Show Me an Example
          </h2>
          <p className="font-body mt-2 text-sm text-gray-500">
            Watch a model answer walkthrough
          </p>
          <button
            type="button"
            onClick={onStartWalkthrough}
            disabled={loading}
            className="case-btn-primary mt-5 w-full"
          >
            {loading ? 'Starting...' : 'Start Walkthrough'}
          </button>
        </div>

        <div className="case-action-card rounded-lg border border-[#e8dcc8] bg-white/80 p-6 shadow-sm">
          <span className="text-3xl" aria-hidden>
            🎯
          </span>
          <h2 className="font-body mt-3 text-xl font-semibold text-gray-800">
            I&apos;ll Take a Case
          </h2>
          <p className="font-body mt-2 text-sm text-gray-500">
            Practice with AI as your interviewer
          </p>
          <button
            type="button"
            onClick={onStartPractice}
            disabled={!walkthroughDoneToday}
            title={
              walkthroughDoneToday
                ? undefined
                : 'View the walkthrough first'
            }
            className="case-btn-secondary mt-5 w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Practice
          </button>
        </div>
      </div>

      <p className="font-body mt-6 text-center text-sm text-gray-500">
        Or jump to practice if you&apos;ve already reviewed today&apos;s example{' '}
        <button
          type="button"
          onClick={onSkipToPractice}
          className="text-blue-600 underline hover:text-blue-800 bg-transparent border-0 p-0 cursor-pointer font-body text-sm"
        >
          Skip to Practice
        </button>
      </p>
    </div>
  );
}
