import { format } from 'date-fns';
import PageHeading from '../components/layout/PageHeading';
import HabitCard from '../components/habits/HabitCard';
import StreakCard from '../components/habits/StreakCard';
import HabitHeatmap from '../components/habits/HabitHeatmap';
import Toast from '../components/habits/Toast';
import LoadingLine from '../components/layout/LoadingLine';
import { useHabits } from '../hooks/useHabits';
import { useStreaks } from '../hooks/useStreaks';
import { HABIT_DEFINITIONS } from '../constants/habits';

export default function Habits() {
  const { streaks } = useStreaks();
  const {
    habitsWithMeta,
    history,
    loading,
    error,
    toast,
    togglingKey,
    completeHabit,
  } = useHabits();

  const todayLabel = format(new Date(), 'EEEE, MMM d');

  return (
    <div className="habits-page pb-12">
      <PageHeading>Daily Habits Tracker</PageHeading>

      <section className="mt-6">
        <h2 className="font-handwriting text-2xl text-gray-800 mb-4">
          Today — {todayLabel}
        </h2>

        {loading && (
          <div className="py-6 max-w-xs">
            <LoadingLine />
          </div>
        )}

        {error && !loading && (
          <p className="font-body text-sm text-amber-700 mb-3">
            Could not load habits — {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          {habitsWithMeta.map((habit) => (
            <HabitCard
              key={habit.key}
              name={habit.name}
              description={habit.description}
              completed={habit.completed}
              streak={streaks?.[habit.streakKey]}
              onComplete={() => completeHabit(habit.key)}
              disabled={loading || togglingKey === habit.key}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-handwriting text-2xl text-gray-800 mb-4">
          Streak Summary
        </h2>
        <div className="grid grid-cols-2 gap-3 tablet:gap-4 desktop:grid-cols-3">
          {HABIT_DEFINITIONS.map((habit) => {
            const entry = streaks?.[habit.streakKey];
            return (
              <StreakCard
                key={habit.key}
                icon={habit.icon}
                label={habit.stripLabel}
                current={entry?.current ?? 0}
                longest={entry?.longest ?? 0}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <HabitHeatmap history={history} loading={loading} />
      </section>

      <Toast message={toast} />
    </div>
  );
}
