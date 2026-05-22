import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  fetchHabitsForDate,
  fetchHabitsRange,
  updateHabit,
} from '../services/habitsApi';
import { useStreaks } from './useStreaks';
import { HABIT_DEFINITIONS } from '../constants/habits';

function defaultTodayHabits(date) {
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

export function useHabits() {
  const { setStreaks } = useStreaks();
  const [todayHabits, setTodayHabits] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);

  const getToggleDate = useCallback(
    () => format(new Date(), 'yyyy-MM-dd'),
    []
  );

  const loadData = useCallback(async () => {
    const today = getToggleDate();
    const from = format(subDays(new Date(), 89), 'yyyy-MM-dd');
    const to = today;

    setLoading(true);
    setError(null);

    try {
      const [habit, range] = await Promise.all([
        fetchHabitsForDate(today),
        fetchHabitsRange(from, to),
      ]);
      setTodayHabits(habit);
      setHistory(Array.isArray(range) ? range : []);
    } catch (err) {
      setError(err.message);
      setTodayHabits(defaultTodayHabits(today));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [getToggleDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const completeHabit = useCallback(
    async (habitKey) => {
      if (!todayHabits) return;
      if (todayHabits[habitKey]) return;

      const date = getToggleDate();
      const previousHabits = { ...todayHabits };

      setTodayHabits((prev) => ({ ...prev, [habitKey]: true }));
      setTogglingKey(habitKey);

      try {
        const { habit, streaks } = await updateHabit(date, habitKey, true);
        setTodayHabits(habit);
        setStreaks(streaks);

        setHistory((prev) => {
          const next = [...prev];
          const index = next.findIndex((item) => item.date === habit.date);
          if (index >= 0) {
            next[index] = habit;
          } else {
            next.push(habit);
          }
          return next;
        });
      } catch (err) {
        setTodayHabits(previousHabits);
        showToast("Couldn't save — check connection");
        throw err;
      } finally {
        setTogglingKey(null);
      }
    },
    [todayHabits, getToggleDate, setStreaks, showToast]
  );

  const habitsWithMeta = HABIT_DEFINITIONS.map((def) => ({
    ...def,
    completed: todayHabits ? Boolean(todayHabits[def.key]) : false,
  }));

  return {
    todayHabits,
    habitsWithMeta,
    history,
    loading,
    error,
    toast,
    togglingKey,
    refresh: loadData,
    completeHabit,
  };
}
