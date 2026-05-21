const { format, parseISO, isValid } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const { getPracticeSessionsContainer } = require('../shared/cosmosClient');
const { updateLearningProfileAfterSession } = require('../shared/learningProfileRepository');
const { getHabitByDate, upsertHabit } = require('../shared/habitsRepository');
const { getStreaks, upsertStreaks } = require('../shared/streaksRepository');
const { applyStreakToggle } = require('../shared/streakLogic');

const HABIT_KEYS = {
  product: 'product_practiced',
  tpm: 'tpm_practiced',
};

function isValidDateStr(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return isValid(parseISO(dateStr));
}

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, body: { error: 'Method not allowed' } };
    return;
  }

  try {
    const body = req.body || {};
    const { type, date, caseMetadata, conversation, scores, band, feedback, hintUsed } =
      body;

    if (!['product', 'tpm'].includes(type)) {
      context.res = { status: 400, body: { error: 'type must be product or tpm' } };
      return;
    }

    const sessionDate = date || format(new Date(), 'yyyy-MM-dd');
    if (!isValidDateStr(sessionDate)) {
      context.res = { status: 400, body: { error: 'Invalid date' } };
      return;
    }

    const container = getPracticeSessionsContainer();
    const sessionDoc = {
      id: body.id || uuidv4(),
      date: sessionDate,
      type,
      mode: 'live',
      caseMetadata,
      conversation: conversation || [],
      scores,
      band,
      feedback,
      hintUsed: Boolean(hintUsed),
      savedToReviewBank: true,
    };

    const { resource: savedSession } = await container.items.upsert(sessionDoc);

    const profile = await updateLearningProfileAfterSession(type, {
      scores,
      feedback,
      caseMetadata: {
        ...caseMetadata,
        domain: caseMetadata?.domain || caseMetadata?.practiceDomain,
      },
    });

    const habitKey = HABIT_KEYS[type];
    const existing = await getHabitByDate(sessionDate);
    if (!existing[habitKey]) {
      await upsertHabit(sessionDate, habitKey, true);
      const currentStreaks = await getStreaks();
      const updatedStreaks = applyStreakToggle(
        currentStreaks,
        habitKey,
        true,
        sessionDate,
        false
      );
      await upsertStreaks(updatedStreaks);
    }

    context.res = {
      status: 200,
      body: { session: savedSession, learningProfile: profile },
    };
  } catch (error) {
    context.log.error('saveLiveSession error:', error.message || error);
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to save session' },
    };
  }
};
