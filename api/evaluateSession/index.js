const { format } = require('date-fns');
const { getOpenAIClient } = require('../shared/openaiClient');
const {
  buildScoringSystemPrompt,
  buildScoringUserPrompt,
  normalizeEvaluation,
} = require('../shared/scoringPrompt');

function parseModelJson(content) {
  let text = content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(text);
}

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, body: { error: 'Method not allowed' } };
    return;
  }

  try {
    const body = req.body || {};
    const { caseContext, conversationHistory, hintUsed } = body;

    if (!caseContext?.problemStatement) {
      context.res = {
        status: 400,
        body: { error: 'caseContext is required' },
      };
      return;
    }

    const history = conversationHistory || [];
    const userMessages = history.filter((m) => m.role === 'user');

    if (userMessages.length === 0) {
      context.res = {
        status: 400,
        body: { error: "You haven't started yet — at least attempt the case." },
      };
      return;
    }

    const openai = getOpenAIClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    const completion = await openai.chat.completions.create({
      model: deployment,
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildScoringSystemPrompt(caseContext, Boolean(hintUsed)),
        },
        {
          role: 'user',
          content: buildScoringUserPrompt(caseContext, history),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty scoring response');
    }

    const parsed = parseModelJson(content);
    const evaluation = normalizeEvaluation(parsed, Boolean(hintUsed));

    try {
      const { getHabitByDate, upsertHabit } = require('../shared/habitsRepository');
      const { getStreaks, upsertStreaks } = require('../shared/streaksRepository');
      const { applyStreakToggle } = require('../shared/streakLogic');

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const type = caseContext.type || 'product';
      const habitKey = type === 'tpm' ? 'tpm_practiced' : 'product_practiced';

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
      context.log.warn('automatic evaluate session habit ticking failed:', err.message);
    }

    context.res = { status: 200, body: evaluation };
  } catch (error) {
    context.log.error('evaluateSession error:', error.message || error);
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to evaluate session' },
    };
  }
};
