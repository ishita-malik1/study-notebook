const HABIT_FIELDS = [
  'jobs_applied',
  'recruiters_contacted',
  'product_walkthrough',
  'product_practiced',
  'tpm_walkthrough',
  'tpm_practiced',
];

const STREAK_KEYS = {
  jobs_applied: 'jobs',
  recruiters_contacted: 'recruiters',
  product_walkthrough: 'product_walkthrough',
  product_practiced: 'product',
  tpm_walkthrough: 'tpm_walkthrough',
  tpm_practiced: 'tpm',
};

function defaultHabitDocument(date) {
  return {
    id: `habit-${date}`,
    date,
    jobs_applied: false,
    recruiters_contacted: false,
    product_walkthrough: false,
    product_practiced: false,
    tpm_walkthrough: false,
    tpm_practiced: false,
  };
}

function defaultStreaksDocument() {
  return {
    id: 'streaks-main',
    jobs: { current: 0, longest: 0, lastCompleted: null },
    recruiters: { current: 0, longest: 0, lastCompleted: null },
    product_walkthrough: { current: 0, longest: 0, lastCompleted: null },
    product: { current: 0, longest: 0, lastCompleted: null },
    tpm_walkthrough: { current: 0, longest: 0, lastCompleted: null },
    tpm: { current: 0, longest: 0, lastCompleted: null },
  };
}

module.exports = {
  HABIT_FIELDS,
  STREAK_KEYS,
  defaultHabitDocument,
  defaultStreaksDocument,
};
