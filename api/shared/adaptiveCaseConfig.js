const { DOMAINS, PROBLEM_TYPES, TPM_CASE_TYPES, FRAMEWORK_STEPS } = require('./caseFrameworkData');

const DIFFICULTY_CONFIGS = {
  beginner: {
    ambiguity: 'low — problem statement is clear and specific',
    userSegments: 'one obvious primary user',
    dataAvailable: 'metrics are straightforward',
    constraints: 'none mentioned',
  },
  intermediate: {
    ambiguity: 'medium — problem could be interpreted two ways',
    userSegments: '2-3 plausible segments, user must choose and justify',
    dataAvailable: 'one metric seems important but may be misleading',
    constraints: 'mention a resource or timeline constraint',
  },
  advanced: {
    ambiguity: 'high — the brief contains a red herring metric',
    userSegments: '3+ segments with conflicting needs',
    dataAvailable: 'data appears to contradict the stated problem',
    constraints: 'regulatory constraint or political constraint between teams',
  },
};

function normalizeDomain(value) {
  if (!value) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, '_');
}

function pickProblemType(caseType, profile) {
  const pool = caseType === 'tpm' ? TPM_CASE_TYPES : PROBLEM_TYPES;

  if (!profile) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const recent = (profile.recentProblemTypes || []).slice(0, 3);
  let available = pool.filter((t) => !recent.includes(t));

  if (available.length === 0) {
    const oldest = (profile.recentProblemTypes || [])[
      profile.recentProblemTypes.length - 1
    ];
    available = oldest ? [oldest] : pool;
  }

  return available[Math.floor(Math.random() * available.length)];
}

function pickDomain(excluded = []) {
  const blocked = new Set(excluded.map(normalizeDomain).filter(Boolean));
  const available = DOMAINS.filter((d) => !blocked.has(normalizeDomain(d)));

  if (available.length === 0) {
    return DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

function resolveDifficultyLevel(profile) {
  if (!profile) return 'beginner';

  const sessionsTotal = profile.sessions_total || 0;
  let level =
    profile.current_level || profile.difficulty || 'beginner';

  if (sessionsTotal < 3) {
    return 'beginner';
  }

  if (sessionsTotal < 10 && level === 'advanced') {
    level = 'intermediate';
  }

  return level;
}

function resolveWeakAreas(profile) {
  if (!profile) return [];

  const sessionsTotal = profile.sessions_total || 0;

  if (sessionsTotal >= 3) {
    const fromData = profile.weak_areas || profile.weakSteps || [];
    if (fromData.length > 0) return fromData;
  }

  if (profile.initial_weak_areas?.length) {
    return profile.initial_weak_areas;
  }

  return profile.weak_areas || profile.weakSteps || [];
}

function getStepNamesForPrompt(stepIds) {
  return stepIds
    .map((id) => {
      const step = FRAMEWORK_STEPS.find((s) => s.id === id);
      return step ? `${id} (${step.name})` : id;
    })
    .join(', ');
}

function buildGenerationPlan(caseType, profile) {
  const problemType = pickProblemType(caseType, profile);
  const difficultyLevel = resolveDifficultyLevel(profile);
  const difficultyConfig = DIFFICULTY_CONFIGS[difficultyLevel];
  const weakAreas = resolveWeakAreas(profile);

  const domainsUsed = (profile?.domainsUsed || []).map(normalizeDomain);
  const lastSessionDomain = domainsUsed[0] || null;

  const excludedForWalkthrough = [...domainsUsed.slice(0, 1)];
  if (lastSessionDomain) excludedForWalkthrough.push(lastSessionDomain);

  const walkthroughDomain = pickDomain(excludedForWalkthrough);

  const excludedForPractice = [
    normalizeDomain(walkthroughDomain),
    ...domainsUsed.slice(0, 2),
  ].filter(Boolean);

  const practiceDomain = pickDomain(excludedForPractice);

  const recentDomainsList = domainsUsed.length
    ? domainsUsed.join(', ')
    : 'none yet';

  const weakAreasPrompt =
    weakAreas.length > 0
      ? `The scenario should naturally require strong execution of these steps: ${getStepNamesForPrompt(weakAreas)}. Make it impossible to score well without addressing them specifically.`
      : 'none yet';

  return {
    problemType,
    difficultyLevel,
    difficultyConfig,
    weakAreas,
    weakAreasPrompt,
    walkthroughDomain,
    practiceDomain,
    excludedDomains: [
      normalizeDomain(walkthroughDomain),
      normalizeDomain(practiceDomain),
    ],
    recentDomainsList,
    recentProblemTypes: profile?.recentProblemTypes || [],
    sessionsTotal: profile?.sessions_total || 0,
    isAdaptive: (profile?.sessions_total || 0) >= 3,
  };
}

function buildAdaptivePromptAppendix(plan) {
  return `
---
Difficulty level for this session: ${plan.difficultyLevel}
Difficulty parameters: ${JSON.stringify(plan.difficultyConfig)}
Weak areas to target (build scenario around these): ${plan.weakAreasPrompt}
Problem type to use: ${plan.problemType}
Domains already used recently: ${plan.recentDomainsList} — do not use these for either case.

DOMAIN ASSIGNMENT (required):
- Walkthrough case MUST use industry domain: ${plan.walkthroughDomain}
- Practice case MUST use industry domain: ${plan.practiceDomain}
- Both cases must use different companies and the same problemType: ${plan.problemType}
---`;
}

function buildFallbackPlan(caseType) {
  const problemType = pickProblemType(caseType, null);
  const walkthroughDomain = pickDomain([]);
  const practiceDomain = pickDomain([walkthroughDomain]);

  return {
    problemType,
    difficultyLevel: 'beginner',
    difficultyConfig: DIFFICULTY_CONFIGS.beginner,
    weakAreas: [],
    weakAreasPrompt: 'none yet',
    walkthroughDomain,
    practiceDomain,
    excludedDomains: [
      normalizeDomain(walkthroughDomain),
      normalizeDomain(practiceDomain),
    ],
    recentDomainsList: 'none yet',
    recentProblemTypes: [],
    sessionsTotal: 0,
    isAdaptive: false,
  };
}

module.exports = {
  DIFFICULTY_CONFIGS,
  buildGenerationPlan,
  buildAdaptivePromptAppendix,
  buildFallbackPlan,
  pickProblemType,
  pickDomain,
  normalizeDomain,
  resolveDifficultyLevel,
};
