import { useState } from 'react';
import { FRAMEWORK_STEPS } from '../../constants/caseFramework';

const FAMILIARITY_OPTIONS = [
  { id: 'never', label: 'Never done one' },
  { id: 'tried', label: 'Tried a few but feel unsure' },
  { id: 'several', label: 'Done several, want to sharpen' },
];

const ROLE_OPTIONS = [
  { id: 'pm', label: 'Product Manager' },
  { id: 'tpm', label: 'TPM' },
  { id: 'both', label: 'Both' },
];

export default function DiagnosticModal({ caseType, onComplete }) {
  const [familiarity, setFamiliarity] = useState('');
  const [weakSteps, setWeakSteps] = useState([]);
  const [rolePreference, setRolePreference] = useState(
    caseType === 'tpm' ? 'tpm' : 'pm'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleWeakStep = (stepId) => {
    setWeakSteps((prev) => {
      if (prev.includes(stepId)) {
        return prev.filter((id) => id !== stepId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, stepId];
    });
  };

  const canSubmit =
    familiarity && weakSteps.length > 0 && rolePreference && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        familiarity,
        weakSteps,
        rolePreference,
      });
    } catch (err) {
      setError(err.message || 'Failed to save setup');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl font-body p-6"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Quick Setup — 1 minute
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Help us personalize your first case
        </p>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-800 mb-2">
            1. How familiar are you with PM case interviews?
          </p>
          <div className="space-y-2">
            {FAMILIARITY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name="familiarity"
                  checked={familiarity === opt.id}
                  onChange={() => setFamiliarity(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-800 mb-2">
            2. Which parts feel hardest? (pick up to 3)
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {FRAMEWORK_STEPS.map((step) => (
              <label
                key={step.id}
                className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={weakSteps.includes(step.id)}
                  onChange={() => toggleWeakStep(step.id)}
                  disabled={
                    !weakSteps.includes(step.id) && weakSteps.length >= 3
                  }
                  className="mt-0.5"
                />
                <span>{step.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-800 mb-2">
            3. Preparing for Product Manager or TPM roles?
          </p>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name="role"
                  checked={rolePreference === opt.id}
                  onChange={() => setRolePreference(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="case-btn-primary mt-6 w-full"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
