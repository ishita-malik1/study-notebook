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
const MAX_CONVERSATION_ATTEMPTS = 3;
const MIN_CONVERSATION_LENGTH = 16;
const MIN_THINKING_LEN = 180;
const MAX_COMMON_SLIP_SENTENCES = 2;
const MIN_COMMON_SLIP_LEN = 30;
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

function normalizeParsedShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  return {
    ...parsed,
    walkthroughCase:
      parsed.walkthroughCase ||
      parsed.walkthrough_case ||
      parsed.walkthrough ||
      null,
    practiceCase:
      parsed.practiceCase ||
      parsed.practice_case ||
      parsed.practice ||
      null,
  };
}

function countSentences(text) {
  if (!text) return 0;
  const parts = text.match(/[^.!?]+[.!?]+/g);
  return parts ? parts.length : 1;
}

function wordOverlapRatio(a, b) {
  const tokenize = (s) =>
    new Set(
      String(s)
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4)
    );
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap += 1;
  });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

function getFieldSeparationErrors(message) {
  const errors = [];
  const { thinking, commonSlip, says, coachNote } = message;
  if (!thinking) return errors;

  if (
    /\b(weak(er)? candidate|most candidates (?:would|do|jump|skip)|temptation|tempting|others would|what not to do|avoid jumping to)\b/i.test(
      thinking
    )
  ) {
    errors.push(
      'thinking must not mention mistakes or weak candidates — decision and reasoning only'
    );
  }

  if (commonSlip) {
    if (countSentences(commonSlip) > MAX_COMMON_SLIP_SENTENCES) {
      errors.push('commonSlip must be one sentence');
    }
    if (/\b(you should|should ask|make sure to|be sure to|make sure you|try asking|instead, you should)\b/i.test(commonSlip)) {
      errors.push('commonSlip must not contain advice');
    }
    if (wordOverlapRatio(thinking, commonSlip) > 0.65) {
      errors.push('commonSlip overlaps with thinking');
    }
  }

  if (coachNote) {
    if (
      /\b(this case|the company|notice how|weak candidate|jump to solutions|avoid jumping)\b/i.test(
        coachNote
      )
    ) {
      errors.push(
        'coachNote must be a universal technique, not case-specific commentary'
      );
    }
    if (wordOverlapRatio(thinking, coachNote) > 0.65) {
      errors.push('coachNote overlaps with thinking');
    }
    if (commonSlip && wordOverlapRatio(commonSlip, coachNote) > 0.65) {
      errors.push('coachNote overlaps with commonSlip');
    }
  }

  if (says && /\b(I am going to|I will ask|my plan is to|internally)\b/i.test(says)) {
    errors.push('says must be spoken words only, no meta-commentary');
  }

  return errors;
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
    const thinking =
      message.thinking ||
      message.thinkingAloud ||
      message.internalMonologue ||
      '';
    let commonSlip =
      message.commonSlip ||
      message.common_slip ||
      message.commonSlipText ||
      message.whatNotToDo ||
      '';

    return {
      role: 'candidate',
      thinking,
      says:
        message.says ||
        message.said ||
        message.response ||
        message.content ||
        '',
      commonSlip,
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

function enrichCase(caseData, frameworkSteps, expectedProblemType, expectedDomain) {
  if (!caseData) return caseData;

  const enriched = { ...caseData };
  enriched.problemType = normalizeProblemType(
    enriched.problemType,
    expectedProblemType
  );

  if (expectedDomain) {
    enriched.domain = expectedDomain;
  }

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

function normalizeCasePair(parsed, frameworkSteps, generationPlan) {
  const shaped = normalizeParsedShape(parsed);
  if (!shaped?.walkthroughCase || !shaped?.practiceCase) return shaped;

  return {
    walkthroughCase: enrichCase(
      shaped.walkthroughCase,
      frameworkSteps,
      generationPlan.problemType,
      generationPlan.walkthroughDomain
    ),
    practiceCase: enrichCase(
      shaped.practiceCase,
      frameworkSteps,
      generationPlan.problemType,
      generationPlan.practiceDomain
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

function buildCasesOnlySystemPrompt(type, frameworkSteps, generationPlan) {
  const roleLabel = type === 'tpm' ? 'TPM' : 'PM';
  const adaptiveBlock = buildAdaptivePromptAppendix(generationPlan);

  return `You are a ${roleLabel} interview coach generating a case study pair.
You will generate TWO case briefs in one JSON object. Do NOT include a conversation.

${CASE_QUALITY_RULES}

PAIRING RULES:
1. Both cases must have the SAME problemType (exact string from the user message)
2. Different companies AND different industry domains
3. practiceCase first, then walkthroughCase — each with full problemStatement (120+ chars)
4. walkthroughCase must NOT include a "conversation" field

Framework steps (for context only — conversation is generated separately):
${buildFrameworkPromptText(frameworkSteps)}
${adaptiveBlock}

Return JSON:
{
  "practiceCase": {
    "problemStatement": string,
    "companyProfile": string,
    "situationBrief": string,
    "theAsk": string,
    "company": string,
    "domain": string,
    "problemType": string
  },
  "walkthroughCase": {
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

function buildConversationSystemPrompt(type, frameworkSteps, generationPlan) {
  const roleLabel = type === 'tpm' ? 'TPM' : 'PM';
  const adaptiveBlock = buildAdaptivePromptAppendix(generationPlan);

  return `You are a ${roleLabel} interview coach generating ONLY the ideal walkthrough conversation for a case already defined by the user.

The conversation must follow these 8 steps in order:
${buildFrameworkPromptText(frameworkSteps)}

${WALKTHROUGH_CONVERSATION_RULES}
${adaptiveBlock}

CRITICAL:
- Return JSON: { "conversation": [ ... ] }
- The conversation array MUST contain at least ${MIN_CONVERSATION_LENGTH} messages
- For each of step1 through step8: at least 1 interviewer message AND at least 1 candidate message (8 candidate turns minimum)
- Prefer 2 exchanges per step (interviewer → candidate → interviewer → candidate) = 32 messages when possible
- Every candidate message: thinking, commonSlip, says, coachNote, stepId, stepName
- Each of the four candidate fields must carry UNIQUE information — see FIELD DEFINITIONS and VALIDATION rules
- thinking = decision fork only; commonSlip = one-sentence mistake observation; says = spoken words; coachNote = universal interview technique
- Every interviewer message: content, stepId, stepName
- Do not truncate — complete the full conversation through step8`;
}

function buildConversationUserPrompt(walkthroughCase, validationErrors, attemptIndex) {
  const context = {
    company: walkthroughCase.company,
    domain: walkthroughCase.domain,
    problemType: walkthroughCase.problemType,
    problemStatement: walkthroughCase.problemStatement,
  };

  let prompt = `Generate the walkthrough conversation for this case:\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON with a "conversation" array.`;

  if (validationErrors?.length && attemptIndex > 0) {
    prompt += `\n\nPREVIOUS ATTEMPT FAILED:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nYou MUST return at least ${MIN_CONVERSATION_LENGTH} messages covering all 8 steps. Each candidate turn: thinking = decision fork only; commonSlip = one-sentence mistake (no advice); says = spoken words; coachNote = universal technique (no case/company names). No redundant fields.`;
  }

  return prompt;
}

function buildCasesRetryUserPrompt(basePrompt, validationErrors, attemptIndex) {
  if (!validationErrors?.length || attemptIndex === 0) return basePrompt;

  return `${basePrompt}

PREVIOUS OUTPUT FAILED VALIDATION. Fix every issue:
${validationErrors.map((e) => `- ${e}`).join('\n')}

Critical: include complete practiceCase and walkthroughCase with problemStatement (120+ chars). Do NOT include conversation.`;
}

function normalizeConversation(raw, frameworkSteps) {
  const list = raw?.conversation || raw?.messages || raw;
  if (!Array.isArray(list)) return [];

  const normalized = list
    .map((m) => normalizeMessage(m, frameworkSteps))
    .filter(Boolean);

  return assignStepIdsToConversation(normalized, frameworkSteps);
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
  if (!message.commonSlip || message.commonSlip.length < MIN_COMMON_SLIP_LEN) {
    errors.push(`commonSlip too short (${message.commonSlip?.length || 0})`);
  }
  if (!message.says || message.says.length < MIN_SAYS_LEN) {
    errors.push(`says too short (${message.says?.length || 0})`);
  }
  if (!message.coachNote || message.coachNote.length < MIN_COACH_LEN) {
    errors.push(`coachNote too short (${message.coachNote?.length || 0})`);
  }

  errors.push(...getFieldSeparationErrors(message));

  return errors;
}

function getCasePairErrors(result, generationPlan) {
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

  return errors;
}

function getConversationErrors(conversation, frameworkSteps) {
  const errors = [];

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

  const minCandidates = 8;
  const minInterviewers = 8;
  const minStepsWithCandidate = 8;

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

function getValidationErrors(result, generationPlan) {
  const errors = getCasePairErrors(result, generationPlan);
  const walk = result?.walkthroughCase;
  if (!walk || errors.length > 0) return errors;

  const conversation = walk.conversation;
  return errors.concat(getConversationErrors(conversation));
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

  const casesSystemPrompt = buildCasesOnlySystemPrompt(
    type,
    frameworkSteps,
    generationPlan
  );
  const baseUserPrompt = buildUserPrompt(type, generationPlan);

  let casePair = null;
  let lastError;
  let lastCaseErrors = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const userPrompt = buildCasesRetryUserPrompt(
      baseUserPrompt,
      lastCaseErrors,
      attempt
    );

    try {
      const raw = await callOpenAI(casesSystemPrompt, userPrompt);
      const parsed = normalizeCasePair(
        parseModelJson(raw),
        frameworkSteps,
        generationPlan
      );

      const caseErrors = getCasePairErrors(parsed, generationPlan);

      if (caseErrors.length === 0) {
        casePair = parsed;
        break;
      }

      lastCaseErrors = caseErrors;
      log(
        `generateCase cases attempt ${attempt + 1} validation failed:`,
        caseErrors.join('; ')
      );
      lastError = new Error(
        `Case briefs failed validation: ${caseErrors.slice(0, 5).join('; ')}`
      );
    } catch (err) {
      lastError = err;
      log(`generateCase cases attempt ${attempt + 1} error:`, err.message);
    }
  }

  if (!casePair) {
    if (lastCaseErrors.length) {
      throw new Error(
        `Case briefs failed validation after ${MAX_ATTEMPTS} attempts. Issues: ${lastCaseErrors.slice(0, 6).join('; ')}`
      );
    }
    throw lastError || new Error('Failed to generate case briefs');
  }

  const conversationSystemPrompt = buildConversationSystemPrompt(
    type,
    frameworkSteps,
    generationPlan
  );

  let lastConversationErrors = [];

  for (let attempt = 0; attempt < MAX_CONVERSATION_ATTEMPTS; attempt += 1) {
    const userPrompt = buildConversationUserPrompt(
      casePair.walkthroughCase,
      lastConversationErrors,
      attempt
    );

    try {
      const raw = await callOpenAI(conversationSystemPrompt, userPrompt);
      const parsed = parseModelJson(raw);
      const conversation = normalizeConversation(parsed, frameworkSteps);

      const conversationErrors = getConversationErrors(
        conversation,
        frameworkSteps
      );

      if (conversationErrors.length === 0) {
        const result = {
          ...casePair,
          walkthroughCase: {
            ...casePair.walkthroughCase,
            conversation,
          },
        };

        return {
          ...result,
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

      lastConversationErrors = conversationErrors;
      log(
        `generateCase conversation attempt ${attempt + 1} validation failed:`,
        conversationErrors.join('; ')
      );
      lastError = new Error(
        `Conversation failed validation: ${conversationErrors.slice(0, 5).join('; ')}`
      );
    } catch (err) {
      lastError = err;
      log(`generateCase conversation attempt ${attempt + 1} error:`, err.message);
    }
  }

  if (lastConversationErrors.length) {
    throw new Error(
      `Conversation failed validation after ${MAX_CONVERSATION_ATTEMPTS} attempts. Issues: ${lastConversationErrors.slice(0, 6).join('; ')}`
    );
  }

  throw lastError || new Error('Failed to generate walkthrough conversation');
}

module.exports = {
  generateWalkthroughPair,
  validateCasePair,
  getValidationErrors,
  getCasePairErrors,
  getConversationErrors,
  normalizeCasePair,
  buildGenerationPlan,
};
