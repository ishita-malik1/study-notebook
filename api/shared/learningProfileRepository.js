const { getLearningProfilesContainer } = require('./cosmosClient');
const { normalizeDomain } = require('./adaptiveCaseConfig');

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const STEP_KEYS = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
  'step8',
];

function profileId(caseType) {
  return `learning-profile-${caseType}`;
}

function defaultProfile(caseType) {
  const step_scores = {};
  const step_averages = {};
  STEP_KEYS.forEach((key) => {
    step_scores[key] = [];
    step_averages[key] = 0;
  });

  return {
    id: profileId(caseType),
    type: caseType,
    sessions_total: 0,
    sessions_at_current_level: 0,
    current_level: 'beginner',
    difficulty: 'beginner',
    step_scores,
    step_averages,
    weak_areas: [],
    initial_weak_areas: [],
    strong_areas: [],
    recentProblemTypes: [],
    domainsUsed: [],
    recent_overall_scores: [],
    diagnostic_completed: false,
    role_preference: null,
  };
}

function getLearningProfileContainer() {
  return getLearningProfilesContainer();
}

async function getLearningProfile(caseType) {
  const container = getLearningProfileContainer();
  const id = profileId(caseType);

  try {
    const { resource } = await container.item(id, id).read();
    return { ...defaultProfile(caseType), ...resource, exists: true };
  } catch (error) {
    if (error.code === 404) return null;
    throw error;
  }
}

function appendScoreHistory(arr, value, max = 10) {
  const next = [...(arr || []), value];
  return next.slice(-max);
}

function calculateAverages(step_scores) {
  const averages = {};
  STEP_KEYS.forEach((key) => {
    const arr = step_scores[key] || [];
    averages[key] =
      arr.length > 0
        ? Math.round(
            (arr.reduce((a, b) => a + b, 0) / arr.length) * 10
          ) / 10
        : 0;
  });
  return averages;
}

function deriveAreas(step_averages) {
  const weak_areas = STEP_KEYS.filter(
    (k) => step_averages[k] > 0 && step_averages[k] < 3
  );
  const strong_areas = STEP_KEYS.filter((k) => step_averages[k] >= 4);
  return { weak_areas, strong_areas };
}

function capDifficulty(level, sessionsTotal) {
  let next = level || 'beginner';
  if (sessionsTotal < 10 && next === 'advanced') next = 'intermediate';
  if (sessionsTotal < 3) next = 'beginner';
  return next;
}

function maybeEscalateDifficulty(profile, overallScore) {
  const recent = appendScoreHistory(
    profile.recent_overall_scores,
    overallScore,
    5
  );
  const avgRecent =
    recent.length > 0
      ? recent.reduce((a, b) => a + b, 0) / recent.length
      : 0;

  const nextSessionsTotal = (profile.sessions_total || 0) + 1;
  let current_level = profile.current_level || profile.difficulty || 'beginner';
  let sessions_at_current_level = (profile.sessions_at_current_level || 0) + 1;

  if (nextSessionsTotal >= 3 && avgRecent > 3.8) {
    const idx = DIFFICULTY_LEVELS.indexOf(current_level);
    if (idx < DIFFICULTY_LEVELS.length - 1) {
      let proposed = DIFFICULTY_LEVELS[idx + 1];
      if (proposed === 'advanced' && nextSessionsTotal < 10) {
        proposed = 'intermediate';
      }
      if (proposed !== current_level) {
        current_level = proposed;
        sessions_at_current_level = 0;
      }
    }
  }

  current_level = capDifficulty(current_level, nextSessionsTotal);

  return {
    current_level,
    difficulty: current_level,
    recent_overall_scores: recent,
    sessions_at_current_level,
  };
}

function pushUniqueFront(list, value, max = 5) {
  if (!value) return list || [];
  const normalized = String(value);
  return [normalized, ...(list || []).filter((v) => v !== normalized)].slice(
    0,
    max
  );
}

function recordDomainsUsed(profile, walkthroughDomain, practiceDomain) {
  const entries = [
    normalizeDomain(walkthroughDomain),
    normalizeDomain(practiceDomain),
  ].filter(Boolean);

  let domainsUsed = profile.domainsUsed || [];
  entries.forEach((d) => {
    domainsUsed = pushUniqueFront(domainsUsed, d, 5);
  });

  return domainsUsed;
}

async function upsertProfile(profile) {
  const container = getLearningProfileContainer();
  const { resource } = await container.items.upsert(profile);
  return resource;
}

async function createDiagnosticProfile(caseType, diagnostic) {
  const profile = defaultProfile(caseType);

  const familiarity = diagnostic.familiarity || 'never';
  let current_level = 'beginner';
  if (familiarity === 'several') current_level = 'intermediate';

  profile.current_level = current_level;
  profile.difficulty = current_level;
  profile.initial_weak_areas = diagnostic.weakSteps || [];
  profile.weak_areas = [...profile.initial_weak_areas];
  profile.weakSteps = profile.weak_areas;
  profile.role_preference = diagnostic.rolePreference || 'pm';
  profile.diagnostic_completed = true;
  profile.sessions_total = 0;
  profile.sessions_at_current_level = 0;
  profile.createdAt = new Date().toISOString();

  return upsertProfile(profile);
}

async function recordCaseGeneration(caseType, result) {
  let profile = (await getLearningProfile(caseType)) || defaultProfile(caseType);
  const walk = result.walkthroughCase || {};
  const practice = result.practiceCase || {};
  const meta = result.generationMeta || {};

  const problemType = meta.problemType || walk.problemType;
  const walkDomain = meta.walkthroughDomain || walk.domain;
  const practiceDomain = meta.practiceDomain || practice.domain;

  if (problemType) {
    profile.recentProblemTypes = pushUniqueFront(
      profile.recentProblemTypes,
      problemType,
      5
    );
  }

  profile.domainsUsed = recordDomainsUsed(
    profile,
    walkDomain,
    practiceDomain
  );
  profile.diagnostic_completed = true;
  profile.updatedAt = new Date().toISOString();

  return upsertProfile(profile);
}

async function updateLearningProfileAfterSession(caseType, sessionResult) {
  let profile =
    (await getLearningProfile(caseType)) || defaultProfile(caseType);
  const { scores, feedback, caseMetadata } = sessionResult;
  const problemType = caseMetadata?.problemType;
  const walkDomain = caseMetadata?.domain;

  STEP_KEYS.forEach((key) => {
    profile.step_scores[key] = appendScoreHistory(
      profile.step_scores[key],
      scores[key] ?? 0
    );
  });

  profile.step_averages = calculateAverages(profile.step_scores);
  const areas = deriveAreas(profile.step_averages);

  if (profile.sessions_total >= 3) {
    profile.weak_areas = areas.weak_areas;
    profile.strong_areas = areas.strong_areas;
  } else if (profile.initial_weak_areas?.length) {
    profile.weak_areas = profile.initial_weak_areas;
  } else {
    profile.weak_areas = areas.weak_areas;
  }

  profile.weakSteps = profile.weak_areas;

  if (problemType) {
    profile.recentProblemTypes = pushUniqueFront(
      profile.recentProblemTypes,
      problemType,
      5
    );
  }

  if (walkDomain) {
    profile.domainsUsed = pushUniqueFront(
      profile.domainsUsed,
      normalizeDomain(walkDomain),
      5
    );
  }

  const escalation = maybeEscalateDifficulty(profile, scores.overall);
  profile.current_level = escalation.current_level;
  profile.difficulty = escalation.difficulty;
  profile.recent_overall_scores = escalation.recent_overall_scores;
  profile.sessions_at_current_level = escalation.sessions_at_current_level;
  profile.sessions_total = (profile.sessions_total || 0) + 1;
  profile.last_feedback = feedback;
  profile.updatedAt = new Date().toISOString();

  return upsertProfile(profile);
}

module.exports = {
  getLearningProfile,
  updateLearningProfileAfterSession,
  recordCaseGeneration,
  createDiagnosticProfile,
  defaultProfile,
  profileId,
};
