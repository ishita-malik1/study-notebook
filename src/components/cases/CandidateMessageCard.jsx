import { useState } from 'react';

export default function CandidateMessageCard({ message }) {
  const [thinkingOpen, setThinkingOpen] = useState(true);

  const thinking = message.thinking || '';
  const says = message.says || message.content || '';
  const coachNote = message.coachNote || '';

  return (
    <div className="candidate-card conversation-bubble flex w-full flex-col gap-2 ml-auto">
      <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400 self-end">
        Ideal Answer
      </span>

      <div className="candidate-card-inner flex flex-col gap-2 rounded-lg overflow-hidden border border-[#e8dcc8] shadow-sm">
        {thinking && (
          <div className="candidate-thinking">
            <button
              type="button"
              onClick={() => setThinkingOpen((open) => !open)}
              className="candidate-thinking-header w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                💭 Thinking
              </span>
              <span
                className="text-gray-400 text-xs transition-transform"
                aria-hidden
                style={{
                  transform: thinkingOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ›
              </span>
            </button>
            {thinkingOpen && (
              <p className="candidate-thinking-body px-3 pb-3 font-body text-sm italic leading-relaxed text-gray-600">
                {thinking}
              </p>
            )}
          </div>
        )}

        {says && (
          <div className="candidate-says px-4 py-3">
            <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-2">
              💬 Said
            </span>
            <p className="font-body text-sm leading-relaxed text-gray-800">
              {says}
            </p>
          </div>
        )}

        {coachNote && (
          <div className="candidate-coach px-4 py-3">
            <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-amber-800 block mb-2">
              📌 Interview Tip
            </span>
            <p className="font-body text-sm font-medium leading-relaxed text-amber-950">
              {coachNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
