import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import StepScoreBars from './StepScoreBars';
import { getBandStyle, sessionTitle, formatProblemType } from '../../utils/scoringDisplay';

const TYPE_STYLES = {
  product: { bg: '#dbeafe', color: '#1d4ed8', label: 'Product' },
  tpm: { bg: '#ede9fe', color: '#5b21b6', label: 'TPM' },
};

export default function ReviewSessionCard({ session, onViewConversation }) {
  const [expanded, setExpanded] = useState(false);
  const typeStyle = TYPE_STYLES[session.type] || TYPE_STYLES.product;
  const bandStyle = getBandStyle(session.band);
  const overall = session.scores?.overall;
  const hasScore = typeof overall === 'number';
  const caseTypeLabel =
    session.type === 'tpm' ? 'TPM Case' : 'Product Case';
  const problemLabel = formatProblemType(session.caseMetadata?.problemType);

  let dateLabel = session.date || '';
  try {
    if (session.date) dateLabel = format(parseISO(session.date), 'MMM d');
  } catch {
    /* keep raw */
  }

  return (
    <article className="review-card rounded-lg border border-[#e8dcc8] bg-white/90 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-2 tablet:gap-3 font-body hover:bg-[#fdf8f0]/80 transition-colors"
      >
        <span className="text-sm text-gray-500 w-14 flex-shrink-0">{dateLabel}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
        >
          {typeStyle.label}
        </span>
        <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
          {sessionTitle(session)}
        </span>
        {hasScore && (
          <span
            className="text-sm font-semibold"
            style={{ color: bandStyle.color }}
          >
            {overall.toFixed(1)} / 5
          </span>
        )}
        <span className="text-gray-400 text-sm" aria-hidden>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#f0e8d8] pt-3 space-y-3 font-body">
          {hasScore && (
            <>
              <p className="text-xs text-gray-500">
                {caseTypeLabel}
                {problemLabel ? ` — ${problemLabel}` : ''}
              </p>
              <StepScoreBars scores={session.scores} />
            </>
          )}
          {session.feedback?.keyLearnings?.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              {session.feedback.keyLearnings.slice(0, 2).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {session.mode === 'walkthrough' && !hasScore && (
            <p className="text-sm text-gray-500">Walkthrough saved for review.</p>
          )}
          <button
            type="button"
            onClick={() => onViewConversation(session)}
            className="case-btn-secondary text-sm"
          >
            See Full Conversation
          </button>
        </div>
      )}
    </article>
  );
}
