import { useState } from 'react';
import StickyNote from './StickyNote';
import HintModal from './HintModal';
import ScoringScreen from './ScoringScreen';
import { usePracticeSession } from '../../hooks/usePracticeSession';

export default function PracticeSession({
  caseType,
  practiceCase,
  onReviewWalkthrough,
  onBackHome,
}) {
  const practice = usePracticeSession({ caseType, practiceCase });
  const [hintOpen, setHintOpen] = useState(false);
  const [endAlert, setEndAlert] = useState(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      practice.sendMessage();
    }
  };

  const handleDone = async () => {
    const result = await practice.endSession();
    if (result?.error) {
      setEndAlert(result.error);
      return;
    }
    setEndAlert(null);
  };

  if (practice.evaluation) {
    return (
      <ScoringScreen
        evaluation={practice.evaluation}
        hintUsed={practice.hintUsed}
        onSave={practice.saveSession}
        onReviewWalkthrough={onReviewWalkthrough}
        onBackHome={onBackHome}
        saving={practice.saving}
        saved={practice.saved}
      />
    );
  }

  if (!practiceCase) {
    return (
      <p className="font-body text-gray-600 mt-6">
        No practice case loaded. Complete a walkthrough first.
      </p>
    );
  }

  return (
    <div className="practice-session mt-4 flex flex-col min-h-[60vh]">
      <StickyNote tilt className="mb-4 flex-shrink-0">
        <p className="font-body text-sm font-semibold text-amber-900/70 mb-1">
          Practice Case — {practiceCase.company} ({practiceCase.domain})
        </p>
        <p className="font-body text-sm tablet:text-base leading-relaxed">
          {practiceCase.problemStatement}
        </p>
      </StickyNote>

      <div className="practice-chat relative flex flex-col flex-1 rounded-lg border border-[#e8dcc8] bg-white/60 min-h-[400px] max-h-[min(70vh,600px)]">
        <div className="flex items-center justify-end gap-2 p-2 border-b border-[#e8dcc8] flex-shrink-0">
          <button
            type="button"
            onClick={() => setHintOpen(true)}
            className="text-xs tablet:text-sm font-body px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            💡 Hint
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={practice.evaluating}
            className="text-xs tablet:text-sm font-body px-3 py-1.5 rounded-md border border-gray-800 bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {practice.evaluating ? 'Scoring...' : '🏁 I\'m Done'}
          </button>
        </div>

        {endAlert && (
          <div className="mx-3 mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            {endAlert}
          </div>
        )}

        <div className="practice-chat-messages flex-1 overflow-y-auto p-3 tablet:p-4 space-y-4">
          {practice.messages.map((msg) => (
            <div
              key={msg.id}
              className={[
                'chat-message-enter',
                msg.role === 'user' ? 'flex justify-end' : 'flex justify-start',
              ].join(' ')}
            >
              {msg.role === 'assistant' ? (
                <div className="conversation-bubble">
                  <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                    Interviewer
                  </span>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="conversation-bubble rounded-2xl bg-[#fefce8] px-4 py-3 text-sm leading-relaxed text-gray-800 border border-[#fde68a]">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {practice.partialAssistant && (
            <div className="flex justify-start">
              <div className="conversation-bubble">
                <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                  Interviewer
                </span>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800">
                  {practice.partialAssistant}
                  <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />
                </div>
              </div>
            </div>
          )}

          {practice.streamError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <p>Response cut off — continue?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={practice.continueStream}
                  className="case-btn-primary text-xs py-1"
                >
                  Keep partial response
                </button>
                <button
                  type="button"
                  onClick={() => practice.sendMessage()}
                  className="case-btn-secondary text-xs py-1"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          <div ref={practice.messagesEndRef} />
        </div>

        <div className="practice-chat-input-bar flex-shrink-0 border-t border-[#e8dcc8] p-3 flex gap-2 items-end">
          <textarea
            rows={3}
            value={practice.input}
            onChange={(e) => practice.setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            disabled={practice.loading || practice.streaming}
            className="flex-1 resize-y min-h-[72px] max-h-[144px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={practice.sendMessage}
            disabled={practice.loading || practice.streaming || !practice.input.trim()}
            className="case-btn-primary practice-send-btn whitespace-nowrap mb-1"
          >
            Send →
          </button>
        </div>
      </div>

      <HintModal
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        onConfirm={() => {
          practice.useHint();
          setHintOpen(false);
        }}
      />
    </div>
  );
}
