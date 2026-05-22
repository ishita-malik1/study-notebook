const { format } = require('date-fns');
const { generateWalkthroughPair } = require('../shared/caseGenerator');
const { TPM_STEP_OVERRIDES } = require('../shared/caseFrameworkData');
const {
  getLearningProfile,
  recordCaseGeneration,
} = require('../shared/learningProfileRepository');

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, body: { error: 'Method not allowed' } };
    return;
  }

  try {
    const body = req.body || {};
    const { type, mode, learningProfile: clientProfile, stepOverrides } = body;

    if (!['product', 'tpm'].includes(type)) {
      context.res = { status: 400, body: { error: 'type must be product or tpm' } };
      return;
    }

    if (mode !== 'walkthrough_pair') {
      context.res = {
        status: 400,
        body: { error: 'Only walkthrough_pair mode is supported' },
      };
      return;
    }

    const overrides =
      stepOverrides || (type === 'tpm' ? TPM_STEP_OVERRIDES : []);

    let profile = null;
    if (clientProfile && typeof clientProfile === 'object') {
      profile = clientProfile;
    } else {
      try {
        profile = await getLearningProfile(type);
      } catch (err) {
        context.log.warn('learningProfile fetch failed, using fallback:', err.message);
        profile = null;
      }
    }

    const result = await generateWalkthroughPair({
      type,
      learningProfile: profile,
      stepOverrides: overrides,
      log: (msg, detail) => context.log.warn(msg, detail || ''),
    });

    try {
      await recordCaseGeneration(type, result);
    } catch (err) {
      context.log.warn('recordCaseGeneration failed:', err.message);
    }

    try {
      const { getHabitByDate, upsertHabit } = require('../shared/habitsRepository');
      const { getStreaks, upsertStreaks } = require('../shared/streaksRepository');
      const { applyStreakToggle } = require('../shared/streakLogic');

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const habitKey = type === 'tpm' ? 'tpm_walkthrough' : 'product_walkthrough';

      const existing = await getHabitByDate(todayStr);
      if (!existing[habitKey]) {
        await upsertHabit(todayStr, habitKey, true);
        const currentStreaks = await getStreaks();
        const updatedStreaks = applyStreakToggle(
          currentStreaks,
          habitKey,
          true,
          todayStr,
          false
        );
        await upsertStreaks(updatedStreaks);
      }
    } catch (err) {
      context.log.warn('automatic walkthrough habit ticking failed:', err.message);
    }

    context.res = { status: 200, body: result };
  } catch (error) {
    context.log.error('generateCase error:', error.message || error);
    const message = error.message || 'Failed to generate case';
    const isValidation =
      message.includes('validation') || message.includes('truncated');
    context.res = {
      status: isValidation ? 422 : 500,
      body: {
        error: message,
        hint: isValidation
          ? 'The model output did not pass quality checks. Retry — if this persists, check API logs for validation details.'
          : 'Check API logs. Ensure Azure OpenAI deployment supports JSON mode and sufficient max_tokens.',
      },
    };
  }
};
