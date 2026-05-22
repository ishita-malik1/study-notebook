const { format, parseISO, isValid } = require('date-fns');
const { savePracticeSession } = require('../shared/sessionsRepository');

function isValidDateStr(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  return isValid(parseISO(dateStr));
}

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, body: { error: 'Method not allowed' } };
    return;
  }

  try {
    const body = req.body || {};

    if (!['product', 'tpm'].includes(body.type)) {
      context.res = { status: 400, body: { error: 'type must be product or tpm' } };
      return;
    }

    if (!body.caseMetadata || !body.pairedPracticeCase) {
      context.res = {
        status: 400,
        body: { error: 'caseMetadata and pairedPracticeCase are required' },
      };
      return;
    }

    const date = body.date || format(new Date(), 'yyyy-MM-dd');
    if (!isValidDateStr(date)) {
      context.res = { status: 400, body: { error: 'Invalid date' } };
      return;
    }

    const saved = await savePracticeSession({
      id: body.id,
      date,
      type: body.type,
      mode: body.mode || 'walkthrough',
      caseMetadata: body.caseMetadata,
      pairedPracticeCase: body.pairedPracticeCase,
      conversation: body.conversation,
    });

    try {
      const { getHabitByDate, upsertHabit } = require('../shared/habitsRepository');
      const { getStreaks, upsertStreaks } = require('../shared/streaksRepository');
      const { applyStreakToggle } = require('../shared/streakLogic');

      const todayStr = date;
      const habitKey = body.type === 'tpm' ? 'tpm_walkthrough' : 'product_walkthrough';

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
      context.log.warn('automatic save walkthrough habit ticking failed:', err.message);
    }

    context.res = { status: 200, body: saved };
  } catch (error) {
    context.log.error('savePracticeSession error:', error);
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to save session' },
    };
  }
};
