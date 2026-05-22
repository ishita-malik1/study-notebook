import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { FRAMEWORK_STEPS } from '../constants/caseFramework';
import { HABIT_DEFINITIONS } from '../constants/habits';

export const STEP_SHORT_NAMES = {
  step1: 'Clarify',
  step2: 'User & Pain',
  step3: 'Root Cause',
  step4: 'Prioritize',
  step5: 'Solution',
  step6: 'Metrics',
  step7: 'Risks',
  step8: 'Recommend',
};

const LEVEL_LABELS = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
};

export function getLiveSessions(sessions) {
  return (sessions || [])
    .filter((s) => s.mode === 'live' && s.scores?.overall != null)
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.id || '').localeCompare(b.id || '');
    });
}

export function countLiveSessions(sessions) {
  return getLiveSessions(sessions).length;
}

export function computeStepAveragesFromSessions(liveSessions) {
  const totals = {};
  const counts = {};

  FRAMEWORK_STEPS.forEach((step) => {
    totals[step.id] = 0;
    counts[step.id] = 0;
  });

  liveSessions.forEach((session) => {
    FRAMEWORK_STEPS.forEach((step) => {
      const score = session.scores?.[step.id];
      if (typeof score === 'number' && score > 0) {
        totals[step.id] += score;
        counts[step.id] += 1;
      }
    });
  });

  const averages = {};
  FRAMEWORK_STEPS.forEach((step) => {
    averages[step.id] =
      counts[step.id] > 0
        ? Math.round((totals[step.id] / counts[step.id]) * 10) / 10
        : 0;
  });

  return averages;
}

export function getRadarData(liveSessions) {
  const averages = computeStepAveragesFromSessions(liveSessions);
  return FRAMEWORK_STEPS.map((step) => ({
    step: step.name,
    fullName: step.name,
    score: averages[step.id] || 0,
    stepId: step.id,
  }));
}

export function getStrongestAndWeakest(averages) {
  const entries = FRAMEWORK_STEPS.map((step) => ({
    name: step.name,
    score: averages[step.id] || 0,
  })).filter((e) => e.score > 0);

  if (entries.length === 0) {
    return { strongest: null, weakest: null };
  }

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
  };
}

export function getScoreTimeline(liveSessions) {
  const product = [];
  const tpm = [];

  const combined = liveSessions.map((session, index) => {
    const sessionNum = index + 1;
    const score =
      Math.round((session.scores?.overall ?? 0) * 10) / 10;
    const row = {
      session: sessionNum,
      product: null,
      tpm: null,
      productMeta: null,
      tpmMeta: null,
    };

    const meta = { sessionNum, score, date: session.date };

    if (session.type === 'tpm') {
      row.tpm = score;
      row.tpmMeta = meta;
      tpm.push(meta);
    } else {
      row.product = score;
      row.productMeta = meta;
      product.push(meta);
    }

    return row;
  });

  return { product, tpm, combined };
}

export function getStepInsights(liveSessions) {
  const averages = computeStepAveragesFromSessions(liveSessions);
  const { strongest, weakest } = getStrongestAndWeakest(averages);

  let mostImproved = null;
  if (liveSessions.length >= 4) {
    const firstBlock = liveSessions.slice(0, 3);
    const lastBlock = liveSessions.slice(-3);

    let bestDelta = -Infinity;
    FRAMEWORK_STEPS.forEach((step) => {
      const avgFirst = averageStepInSessions(firstBlock, step.id);
      const avgLast = averageStepInSessions(lastBlock, step.id);
      if (avgFirst > 0 && avgLast > 0) {
        const delta = avgLast - avgFirst;
        if (delta > bestDelta) {
          bestDelta = delta;
          mostImproved = { name: step.name, delta: Math.round(delta * 10) / 10 };
        }
      }
    });
  }

  return {
    bestStep: strongest,
    biggestGap: weakest,
    mostImproved,
    averages,
  };
}

function averageStepInSessions(sessions, stepId) {
  const scores = sessions
    .map((s) => s.scores?.[stepId])
    .filter((n) => typeof n === 'number' && n > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function getPromotionText(learningProfile) {
  const level = learningProfile?.current_level || 'beginner';
  if (level === 'beginner') return null;

  const atLevel = learningProfile?.sessions_at_current_level ?? 0;
  const total = learningProfile?.sessions_total ?? 0;
  const beforePromotion = Math.max(1, total - atLevel);

  const prev =
    level === 'advanced'
      ? 'Intermediate'
      : level === 'intermediate'
        ? 'Beginner'
        : null;

  if (!prev) return null;
  return `Promoted from ${prev} after ${beforePromotion} session${beforePromotion === 1 ? '' : 's'}`;
}

export function getLevelLabel(level) {
  return LEVEL_LABELS[level] || 'BEGINNER';
}

export function countCompletedHabits(habitDoc) {
  if (!habitDoc) return 0;
  return HABIT_DEFINITIONS.filter((h) => habitDoc[h.key]).length;
}

export function computeConsistencyScore(habits, sessions) {
  const habitDays = (habits || []).filter(
    (doc) => countCompletedHabits(doc) >= 3
  );

  const dates = [
    ...(habits || []).map((h) => h.date).filter(Boolean),
    ...(sessions || []).map((s) => s.date).filter(Boolean),
  ].sort();

  if (dates.length === 0) return 0;

  const first = parseISO(dates[0]);
  const last = parseISO(dates[dates.length - 1]);
  const span = Math.max(1, differenceInCalendarDays(last, first) + 1);
  const qualifyingDays = habitDays.length;

  return Math.round((qualifyingDays / span) * 100);
}

export function formatSessionDate(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}
