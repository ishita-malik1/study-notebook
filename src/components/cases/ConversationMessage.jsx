import CandidateMessageCard from './CandidateMessageCard';

export default function ConversationMessage({ message, showStepPill }) {
  const isInterviewer = message.role === 'interviewer';

  if (!isInterviewer) {
    return (
      <div className="flex flex-col gap-1 items-end w-full">
        {showStepPill && message.stepName && (
          <span className="step-pill font-body text-xs font-semibold text-gray-600 self-end">
            Step {message.stepId?.replace('step', '')} — {message.stepName}
          </span>
        )}
        <CandidateMessageCard message={message} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      {showStepPill && message.stepName && (
        <span className="step-pill font-body text-xs font-semibold text-gray-600">
          Step {message.stepId?.replace('step', '')} — {message.stepName}
        </span>
      )}
      <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Interviewer
      </span>
      <div className="conversation-bubble rounded-2xl bg-sky-100 px-4 py-3 font-body text-sm leading-relaxed text-gray-800">
        {message.content}
      </div>
    </div>
  );
}
