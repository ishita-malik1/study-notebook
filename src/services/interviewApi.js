const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function fetchLearningProfile(caseType) {
  return request(`/learningProfile?type=${encodeURIComponent(caseType)}`);
}

export async function submitDiagnostic({
  type,
  familiarity,
  weakSteps,
  rolePreference,
}) {
  return request('/learningProfile', {
    method: 'POST',
    body: JSON.stringify({
      diagnostic: true,
      type,
      familiarity,
      weakSteps,
      rolePreference,
    }),
  });
}

export async function conductInterview({
  caseContext,
  conversationHistory,
  learningProfile,
}) {
  return request('/conductInterview', {
    method: 'POST',
    body: JSON.stringify({
      caseContext,
      conversationHistory,
      learningProfile,
      action: 'next_message',
    }),
  });
}

export async function conductInterviewStream(
  { caseContext, conversationHistory, learningProfile },
  { onDelta, onDone, onError }
) {
  try {
    const response = await fetch(`${API_BASE}/conductInterview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseContext,
        conversationHistory,
        learningProfile,
        action: 'next_message',
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${response.status})`);
    }

    const contentType = response.headers.get('Content-Type') || '';

    if (!contentType.includes('text/event-stream') || !response.body) {
      const data = await response.json();
      onDelta(data.message || '');
      onDone({ sessionComplete: data.sessionComplete || false });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.delta) {
            fullText += payload.delta;
            onDelta(payload.delta);
          }
          if (payload.done) {
            onDone({
              sessionComplete: payload.sessionComplete || false,
              fullText,
            });
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }

    if (fullText) {
      onDone({ sessionComplete: false, fullText });
    }
  } catch (err) {
    onError(err);
    throw err;
  }
}

export async function evaluateSession({
  caseContext,
  conversationHistory,
  hintUsed,
}) {
  return request('/evaluateSession', {
    method: 'POST',
    body: JSON.stringify({
      caseContext,
      conversationHistory,
      hintUsed,
    }),
  });
}

export async function saveLiveSession(payload) {
  return request('/saveLiveSession', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
