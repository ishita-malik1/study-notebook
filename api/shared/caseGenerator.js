const { getOpenAIClient } = require('./openaiClient');
const {
  FRAMEWORK_STEPS,
  PROBLEM_TYPES,
  TPM_CASE_TYPES,
  applyStepOverrides,
} = require('./caseFrameworkData');
const {
  CASE_QUALITY_RULES,
  WALKTHROUGH_CONVERSATION_RULES,
} = require('./casePrompts');
const {
  buildGenerationPlan,
  buildAdaptivePromptAppendix,
  buildFallbackPlan,
  normalizeDomain,
} = require('./adaptiveCaseConfig');

const MAX_ATTEMPTS = 3;
const MIN_CONVERSATION_LENGTH = 12;
const MIN_THINKING_LEN = 40;
const MIN_SAYS_LEN = 40;
const MIN_COACH_LEN = 12;

const REQUIRED_STEPS = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
  'step8',
];

function normalizeProblemType(value, expected) {
  if (!value) return expected;
  const normalized = String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  const pool = [...PROBLEM_TYPES, ...TPM_CASE_TYPES];
  if (pool.includes(normalized)) return normalized;
  if (normalized === expected) return expected;
  return expected;
}

function normalizeStepId(stepId) {
  if (!stepId) return null;
  const raw = String(stepId).toLowerCase().trim();
  if (/^step\d+$/.test(raw)) return raw;
  const match = raw.match(/(\d+)/);
  if (match) return `step${match[1]}`;
  return null;
}

function getStepName(stepId, frameworkSteps) {
  const step = frameworkSteps.find((s) => s.id === stepId);
  return step?.name || stepId;
}

function normalizeMessage(message, frameworkSteps) {
  const role = message?.role?.toLowerCase?.();
  const stepId = normalizeStepId(message?.stepId || message?.step);
  const stepName =
    message?.stepName || (stepId ? getStepName(stepId, frameworkSteps) : undefined);

  if (role === 'interviewer') {
    return {
      role: 'interviewer',
      content: message.content || message.says || message.text || '',
      stepId,
      stepName,
    };
  }

  if (role === 'candidate') {
    return {
      role: 'candidate',
      thinking:
        message.thinking ||
        message.thinkingAloud ||
        message.internalMonologue ||
        '',
      says:
        message.says ||
        message.said ||
        message.response ||
        message.content ||
        '',
      coachNote:
        message.coachNote ||
        message.coach_note ||
        message.coachnote ||
        message.tip ||
        '',
      stepId,
      stepName,
    };
  }

  return null;
}

/**
 * Models often omit stepId on interviewer turns — infer from context or position.
 */
function assignStepIdsToConversation(messages, frameworkSteps) {
  if (!messages?.length) return messages;

  const msgs = messages.map((m) => ({ ...m }));

  let current = 'step1';
  for (const msg of msgs) {
    const sid = normalizeStepId(msg.stepId);
    if (sid && REQUIRED_STEPS.includes(sid)) current = sid;
    msg.stepId = sid || current;
    msg.stepName = msg.stepName || getStepName(msg.stepId, frameworkSteps);
  }

  current = msgs[msgs.length - 1]?.stepId || 'step8';
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const sid = normalizeStepId(msgs[i].stepId);
    if (sid && REQUIRED_STEPS.includes(sid)) current = sid;
    else msgs[i].stepId = current;
    msgs[i].stepName =
      msgs[i].stepName || getStepName(msgs[i].stepId, frameworkSteps);
  }

  const stepsWithCandidate = new Set(
    msgs.filter((m) => m.role === 'candidate').map((m) => m.stepId)
  );
  const missingCandidateSteps = REQUIRED_STEPS.filter(
    (s) => !stepsWithCandidate.has(s)
  );

  if (missingCandidateSteps.length > 0) {
    const candidates = msgs.filter((m) => m.role === 'candidate');
    if (candidates.length > 0) {
      candidates.forEach((msg, i) => {
        const stepIdx = Math.min(
          7,
          Math.floor((i / candidates.length) * 8)
        );
        msg.stepId = REQUIRED_STEPS[stepIdx];
        msg.stepName = getStepName(msg.stepId, frameworkSteps);
      });
    }

    const perStep = Math.max(1, Math.floor(msgs.length / 8));
    msgs.forEach((msg, i) => {
      const stepIdx = Math.min(7, Math.floor(i / perStep));
      msg.stepId = REQUIRED_STEPS[stepIdx];
      msg.stepName = getStepName(msg.stepId, frameworkSteps);
    });
  }

  current = 'step1';
  for (const msg of msgs) {
    const sid = normalizeStepId(msg.stepId);
    if (sid && REQUIRED_STEPS.includes(sid)) current = sid;
    else msg.stepId = current;
    msg.stepName = msg.stepName || getStepName(msg.stepId, frameworkSteps);
  }

  return msgs;
}

function enrichCase(caseData, frameworkSteps, expectedProblemType) {
  if (!caseData) return caseData;

  const enriched = { ...caseData };
  enriched.problemType = normalizeProblemType(
    enriched.problemType,
    expectedProblemType
  );

  const parts = [
    enriched.companyProfile,
    enriched.situationBrief,
    enriched.theAsk,
  ].filter(Boolean);

  if (
    !enriched.problemStatement ||
    enriched.problemStatement.length < 150
  ) {
    if (parts.length > 0) {
      enriched.problemStatement = parts.join('\n\n');
    }
  }

  if (Array.isArray(enriched.conversation)) {
    const normalized = enriched.conversation
      .map((m) => normalizeMessage(m, frameworkSteps))
      .filter(Boolean);
    enriched.conversation = assignStepIdsToConversation(
      normalized,
      frameworkSteps
    );
  }

  return enriched;
}

function normalizeCasePair(parsed, frameworkSteps, expectedProblemType) {
  if (!parsed?.walkthroughCase || !parsed?.practiceCase) return parsed;

  return {
    walkthroughCase: enrichCase(
      parsed.walkthroughCase,
      frameworkSteps,
      expectedProblemType
    ),
    practiceCase: enrichCase(
      parsed.practiceCase,
      frameworkSteps,
      expectedProblemType
    ),
  };
}

function buildFrameworkPromptText(steps) {
  return steps
    .map(
      (s) =>
        `- ${s.id} "${s.name}": probeQuestions: ${JSON.stringify(s.probeQuestions)}; strongSignals: ${s.strongSignals}`
    )
    .join('\n');
}

function buildSystemPrompt(type, frameworkSteps, generationPlan) {
  const roleLabel = type === 'tpm' ? 'TPM' : 'PM';
  const adaptiveBlock = buildAdaptivePromptAppendix(generationPlan);

  return `You are a ${roleLabel} interview coach generating a realistic case study walkthrough.
You will generate TWO cases in one response as a JSON object.

${CASE_QUALITY_RULES}

PAIRING RULES:
1. Both cases must have the SAME problemType (exact string: use the problem type given in the user message)
2. The two cases MUST use different companies AND different industry domains
3. The walkthrough case shows an ideal candidate conversation with AT LEAST ${MIN_CONVERSATION_LENGTH} total messages
4. The practice case must be a fresh scenario — different company, different domain, same problemType
5. The conversation must follow these 8 steps in order, never skipping:
${buildFrameworkPromptText(frameworkSteps)}

${WALKTHROUGH_CONVERSATION_RULES}
${adaptiveBlock}

CRITICAL JSON REQUIREMENTS:
- Every candidate message MUST include "thinking", "says", and "coachNote" as separate non-empty strings
- Every message (including EVERY interviewer turn) MUST include "stepId" as "step1" through "step8"
- Minimum 16 messages in the conversation (8 steps × 2+ exchanges each)
- Include at least one candidate message per step (step1 through step8)
- problemType must exactly match the user-provided problem type string

Return JSON with this exact shape:
{
  "walkthroughCase": {
    "problemStatement": string,
    "companyProfile": string,
    "situationBrief": string,
    "theAsk": string,
    "company": string,
    "domain": string,
    "problemType": string,
    "conversation": [ ... ]
  },
  "practiceCase": {
    "problemStatement": string,
    "companyProfile": string,
    "situationBrief": string,
    "theAsk": string,
    "company": string,
    "domain": string,
    "problemType": string
  }
}`;
}

function buildUserPrompt(type, generationPlan) {
  const label = type === 'tpm' ? 'TPM' : 'product';
  return `Generate a ${label} case study pair.
Problem type (exact value for problemType in BOTH cases): ${generationPlan.problemType}
Walkthrough domain (exact value for walkthroughCase.domain): ${generationPlan.walkthroughDomain}
Practice domain (exact value for practiceCase.domain): ${generationPlan.practiceDomain}
Return ONLY valid JSON. No markdown. No explanation.`;
}

function parseModelJson(content) {
  let text = content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(text);
}

function isSubstantiveCase(caseData) {
  if (!caseData?.problemStatement) return false;
  if (caseData.problemStatement.length < 120) return false;

  const poorOnly =
    /^[A-Za-z0-9 ]{1,30} is losing users\.?\s*how would you/i.test(
      caseData.problemStatement.trim()
    );
  return !poorOnly;
}

function getCandidateValidationErrors(message) {
  const errors = [];
  if (message.role !== 'candidate') errors.push('not candidate role');
  if (!message.stepId || !REQUIRED_STEPS.includes(message.stepId)) {
    errors.push(`invalid stepId: ${message.stepId}`);
  }
  if (!message.thinking || message.thinking.length < MIN_THINKING_LEN) {
    errors.push(`thinking too short (${message.thinking?.length || 0})`);
  }
  if (!message.says || message.says.length < MIN_SAYS_LEN) {
    errors.push(`says too short (${message.says?.length || 0})`);
  }
  if (!message.coachNote || message.coachNote.length < MIN_COACH_LEN) {
    errors.push(`coachNote too short (${message.coachNote?.length || 0})`);
  }
  return errors;
}

function getValidationErrors(result, generationPlan) {
  const expectedProblemType = generationPlan.problemType;
  const errors = [];
  const walk = result?.walkthroughCase;
  const practice = result?.practiceCase;

  if (!walk) errors.push('missing walkthroughCase');
  if (!practice) errors.push('missing practiceCase');
  if (!walk || !practice) return errors;

  if (!isSubstantiveCase(walk)) {
    errors.push(
      `walkthrough problemStatement too short (${walk.problemStatement?.length || 0} chars)`
    );
  }
  if (!isSubstantiveCase(practice)) {
    errors.push(
      `practice problemStatement too short (${practice.problemStatement?.length || 0} chars)`
    );
  }
  if (!walk.company || !practice.company) errors.push('missing company');
  if (!walk.domain || !practice.domain) errors.push('missing domain');

  if (
    walk.company &&
    practice.company &&
    walk.company.toLowerCase() === practice.company.toLowerCase()
  ) {
    errors.push('same company in both cases');
  }
  const walkDomain = normalizeDomain(walk.domain);
  const practiceDomain = normalizeDomain(practice.domain);

  if (walkDomain && practiceDomain && walkDomain === practiceDomain) {
    errors.push('same domain in both cases');
  }

  if (
    generationPlan.walkthroughDomain &&
    walkDomain !== normalizeDomain(generationPlan.walkthroughDomain)
  ) {
    errors.push(
      `walkthrough domain expected ${generationPlan.walkthroughDomain} got ${walk.domain}`
    );
  }

  if (
    generationPlan.practiceDomain &&
    practiceDomain !== normalizeDomain(generationPlan.practiceDomain)
  ) {
    errors.push(
      `practice domain expected ${generationPlan.practiceDomain} got ${practice.domain}`
    );
  }

  if (walk.problemType !== practice.problemType) {
    errors.push(
      `problemType mismatch walk=${walk.problemType} practice=${practice.problemType}`
    );
  }
  if (walk.problemType !== expectedProblemType) {
    errors.push(
      `problemType expected ${expectedProblemType} got ${walk.problemType}`
    );
  }

  const conversation = walk.conversation;
  if (!Array.isArray(conversation)) {
    errors.push('conversation is not an array');
    return errors;
  }

  if (conversation.length < MIN_CONVERSATION_LENGTH) {
    errors.push(
      `conversation too short (${conversation.length} messages, need ${MIN_CONVERSATION_LENGTH})`
    );
  }

  let candidateCount = 0;
  let interviewerCount = 0;
  const candidatesPerStep = {};

  conversation.forEach((message, index) => {
    if (!message) {
      errors.push(`message ${index} is null`);
      return;
    }

    if (message.role === 'candidate') {
      candidateCount += 1;
      const msgErrors = getCandidateValidationErrors(message);
      if (msgErrors.length) {
        errors.push(`candidate msg ${index}: ${msgErrors.join(', ')}`);
      }
      if (message.stepId) {
        candidatesPerStep[message.stepId] =
          (candidatesPerStep[message.stepId] || 0) + 1;
      }
    } else if (message.role === 'interviewer') {
      interviewerCount += 1;
      if (!message.content || message.content.length < 8) {
        errors.push(`interviewer msg ${index}: content too short`);
      }
    } else {
      errors.push(`message ${index}: unknown role ${message.role}`);
    }
  });

  const minCandidates = conversation.length >= 16 ? 8 : 4;
  const minInterviewers = conversation.length >= 16 ? 8 : 4;
  const minStepsWithCandidate = conversation.length >= 16 ? 8 : 4;

  if (candidateCount < minCandidates) {
    errors.push(
      `too few candidate messages (${candidateCount}, need ${minCandidates}+)`
    );
  }
  if (interviewerCount < minInterviewers) {
    errors.push(
      `too few interviewer messages (${interviewerCount}, need ${minInterviewers}+)`
    );
  }

  const stepsWithCandidate = REQUIRED_STEPS.filter(
    (id) => (candidatesPerStep[id] || 0) > 0
  ).length;
  if (stepsWithCandidate < minStepsWithCandidate) {
    errors.push(
      `only ${stepsWithCandidate} steps have candidate messages (need ${minStepsWithCandidate}+)`
    );
  }

  return errors;
}

function validateCasePair(result, generationPlan) {
  return getValidationErrors(result, generationPlan).length === 0;
}

async function callOpenAI(systemPrompt, userPrompt) {
  const openai = getOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

  const completion = await openai.chat.completions.create({
    model: deployment,
    temperature: 0.7,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from Azure OpenAI');
  }

  if (completion.choices?.[0]?.finish_reason === 'length') {
    throw new Error(
      'Response truncated — try a shorter conversation or increase max_tokens'
    );
  }

  return content;
}

async function generateWalkthroughPair({
  type,
  learningProfile,
  stepOverrides = [],
  log = console.log,
}) {
  const frameworkSteps = applyStepOverrides(FRAMEWORK_STEPS, stepOverrides);

  let generationPlan;
  try {
    generationPlan = learningProfile
      ? buildGenerationPlan(type, learningProfile)
      : buildFallbackPlan(type);
  } catch (err) {
    log('buildGenerationPlan fallback:', err.message);
    generationPlan = buildFallbackPlan(type);
  }

  const systemPrompt = buildSystemPrompt(type, frameworkSteps, generationPlan);
  const userPrompt = buildUserPrompt(type, generationPlan);

  let lastError;
  let lastValidationErrors = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await callOpenAI(systemPrompt, userPrompt);
      const parsed = normalizeCasePair(
        parseModelJson(raw),
        frameworkSteps,
        generationPlan.problemType
      );

      const validationErrors = getValidationErrors(parsed, generationPlan);

      if (validationErrors.length === 0) {
        return {
          ...parsed,
          generationMeta: {
            problemType: generationPlan.problemType,
            difficultyLevel: generationPlan.difficultyLevel,
            walkthroughDomain: generationPlan.walkthroughDomain,
            practiceDomain: generationPlan.practiceDomain,
            weakAreas: generationPlan.weakAreas,
            isAdaptive: generationPlan.isAdaptive,
          },
        };
      }

      lastValidationErrors = validationErrors;
      log(
        `generateCase attempt ${attempt + 1} validation failed:`,
        validationErrors.join('; ')
      );
      lastError = new Error(
        `Generated cases failed validation: ${validationErrors.slice(0, 5).join('; ')}`
      );
    } catch (err) {
      lastError = err;
      log(`generateCase attempt ${attempt + 1} error:`, err.message);
    }
  }

  if (lastValidationErrors.length) {
    throw new Error(
      `Generated cases failed validation after ${MAX_ATTEMPTS} attempts. Issues: ${lastValidationErrors.slice(0, 6).join('; ')}`
    );
  }

  throw lastError || new Error('Failed to generate valid case pair');
}

module.exports = {
  generateWalkthroughPair,
  validateCasePair,
  getValidationErrors,
  normalizeCasePair,
  buildGenerationPlan,
};
