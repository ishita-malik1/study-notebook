const {
  getLearningProfile,
  createDiagnosticProfile,
} = require('../shared/learningProfileRepository');

module.exports = async function (context, req) {
  try {
    if (req.method === 'GET') {
      const caseType = req.query?.type;
      if (!['product', 'tpm'].includes(caseType)) {
        context.res = {
          status: 400,
          body: { error: 'type query param must be product or tpm' },
        };
        return;
      }

      const profile = await getLearningProfile(caseType);
      if (!profile) {
        context.res = {
          status: 200,
          body: { exists: false, needsDiagnostic: true },
        };
        return;
      }

      context.res = {
        status: 200,
        body: {
          ...profile,
          exists: true,
          needsDiagnostic: !profile.diagnostic_completed,
        },
      };
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { type, diagnostic, familiarity, weakSteps, rolePreference } = body;

      if (!diagnostic) {
        context.res = {
          status: 400,
          body: { error: 'diagnostic flag required for POST' },
        };
        return;
      }

      const typesToCreate = [];
      if (rolePreference === 'both') {
        typesToCreate.push('product', 'tpm');
      } else if (rolePreference === 'tpm') {
        typesToCreate.push('tpm');
      } else {
        typesToCreate.push('product');
      }

      if (type && ['product', 'tpm'].includes(type)) {
        if (!typesToCreate.includes(type)) typesToCreate.push(type);
      }

      const results = {};
      for (const caseType of typesToCreate) {
        const existing = await getLearningProfile(caseType);
        if (existing?.diagnostic_completed) {
          results[caseType] = existing;
          continue;
        }

        results[caseType] = await createDiagnosticProfile(caseType, {
          familiarity,
          weakSteps: weakSteps || [],
          rolePreference,
        });
      }

      context.res = {
        status: 200,
        body: results[typesToCreate[0]] || results,
      };
      return;
    }

    context.res = { status: 405, body: { error: 'Method not allowed' } };
  } catch (error) {
    context.log.error('learningProfile error:', error.message || error);
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to process learning profile' },
    };
  }
};
