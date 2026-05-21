import { format } from 'date-fns';
import { fetchLearningProfile } from '../services/interviewApi';

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function hasWalkthroughToday(caseType) {
  return (
    localStorage.getItem(`sn_walkthrough_${caseType}_${todayKey()}`) === 'true'
  );
}

export function markWalkthroughToday(caseType) {
  localStorage.setItem(`sn_walkthrough_${caseType}_${todayKey()}`, 'true');
}

export function getSessionCount(caseType) {
  return parseInt(localStorage.getItem(`sn_${caseType}_sessions`) || '0', 10);
}

export function incrementSessionCount(caseType) {
  const next = getSessionCount(caseType) + 1;
  localStorage.setItem(`sn_${caseType}_sessions`, String(next));
  return next;
}

/** Profile for case generation — server applies adaptive rules; null = fallback */
export async function getLearningProfile(caseType) {
  try {
    const profile = await fetchLearningProfile(caseType);
    if (!profile?.exists) return null;
    return profile;
  } catch {
    return null;
  }
}

export async function needsDiagnostic(caseType) {
  try {
    const profile = await fetchLearningProfile(caseType);
    return !profile?.exists || profile?.needsDiagnostic;
  } catch {
    return true;
  }
}
