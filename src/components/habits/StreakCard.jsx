export default function StreakCard({ icon, label, current, longest }) {
  return (
    <div className="streak-card streak-card-mobile flex flex-col items-center rounded-lg border border-[#e8dcc8] bg-white/70 px-4 py-5 tablet:py-5 shadow-sm">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="font-body mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="font-body mt-1 text-4xl font-bold text-gray-800">
        {current}
      </span>
      <span className="font-body mt-1 text-sm text-gray-500">
        longest: {longest} days
      </span>
    </div>
  );
}
