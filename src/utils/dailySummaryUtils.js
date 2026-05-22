import { format } from 'date-fns';
import { HABIT_DEFINITIONS } from '../constants/habits';
import { FRAMEWORK_STEPS } from '../constants/caseFramework';

export function isAfterFivePm() {
  return new Date().getHours() >= 17;
}

export function getHabitRows(todayHabits) {
  const doc = todayHabits || {};
  return HABIT_DEFINITIONS.map((habit) => ({
    ...habit,
    done: Boolean(doc[habit.key]),
  }));
}

export function getHabitSummaryMessage(rows) {
  const completed = rows.filter((r) => r.done).length;
  const missing = rows.filter((r) => !r.done).map((r) => r.name);

  if (completed === 6) {
    return { completed, message: 'Perfect day. 🎉' };
  }
  if (completed >= 3) {
    return {
      completed,
      message: `${missing.join(', ')} — get them done before midnight`,
    };
  }
  return { completed, message: 'Tomorrow is a fresh start.' };
}

export function findTodayLiveSession(sessions, todayStr) {
  const today = todayStr || format(new Date(), 'yyyy-MM-dd');
  const liveToday = (sessions || []).filter(
    (s) => s.mode === 'live' && s.date === today && s.scores?.overall != null
  );
  if (liveToday.length === 0) return null;
  return liveToday.sort((a, b) => (b.id || '').localeCompare(a.id || ''))[0];
}

function sessionTouchesWeakAreas(session, weakAreaIds) {
  if (!weakAreaIds?.length) return false;
  return weakAreaIds.some((stepId) => {
    const score = session.scores?.[stepId];
    return typeof score === 'number' && score > 0 && score < 3;
  });
}

/**
 * Last 10 sessions' keyLearnings — weak-area sessions first, then recency.
 */
export function pickCumulativeReminders(sessions, weakAreaIds, limit = 3) {
  const live = (sessions || [])
    .filter((s) => s.mode === 'live' && s.feedback?.keyLearnings?.length)
    .sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '');
      if (d !== 0) return d;
      return (b.id || '').localeCompare(a.id || '');
    })
    .slice(0, 10);

  const entries = [];
  live.forEach((session) => {
    const weak = sessionTouchesWeakAreas(session, weakAreaIds);
    (session.feedback.keyLearnings || []).forEach((text, idx) => {
      if (!text?.trim()) return;
      entries.push({
        text: text.trim(),
        weak,
        date: session.date,
        order: idx,
      });
    });
  });

  entries.sort((a, b) => {
    if (a.weak !== b.weak) return a.weak ? -1 : 1;
    const d = (b.date || '').localeCompare(a.date || '');
    if (d !== 0) return d;
    return a.order - b.order;
  });

  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const key = entry.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry.text);
    if (result.length >= limit) break;
  }

  return result;
}

export function weakAreaDisplayName(stepId) {
  const step = FRAMEWORK_STEPS.find((s) => s.id === stepId);
  return step?.name || stepId;
}
