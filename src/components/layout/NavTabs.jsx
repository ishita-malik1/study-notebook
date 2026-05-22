import { NavLink } from 'react-router-dom';

const TABS = [
  {
    label: 'Product Case',
    shortLabel: 'Product',
    icon: '🧠',
    path: '/product-case',
    color: '#4a90d9',
  },
  {
    label: 'TPM Case',
    shortLabel: 'TPM',
    icon: '⚙️',
    path: '/tpm-case',
    color: '#7b68ee',
  },
  {
    label: 'Habits',
    shortLabel: 'Habits',
    icon: '✅',
    path: '/habits',
    color: '#52b788',
  },
  {
    label: 'Progress',
    shortLabel: 'Progress',
    icon: '📈',
    path: '/progress',
    color: '#f4a261',
  },
  {
    label: 'Review Bank',
    shortLabel: 'Review',
    icon: '📚',
    path: '/review-bank',
    color: '#e07b54',
  },
];

export default function NavTabs() {
  return (
    <div
      className="nav-tabs relative z-10 flex items-end overflow-x-auto px-1 tablet:px-4 pt-2 ml-[var(--spiral-width)] scrollbar-thin max-[599px]:overflow-x-hidden"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            [
              'nav-tab-link relative -mb-px flex-1 min-w-0 px-2 tablet:px-5 py-2 text-xs tablet:text-[13px] desktop:text-sm font-medium font-body rounded-t-md transition-all flex-shrink-0',
              'border-t-4 no-underline max-[599px]:flex-none',
              isActive
                ? 'bg-[#fdf8f0] text-gray-800 shadow-sm z-20 -translate-y-0.5'
                : 'bg-[#f0e8d8] text-gray-600 z-10 hover:bg-[#ebe3d3]',
            ].join(' ')
          }
          style={{
            borderTopColor: tab.color,
            marginRight: '-4px',
          }}
        >
          <span className="hidden tablet:inline whitespace-nowrap">{tab.label}</span>
          <span className="flex tablet:hidden flex-col items-center">
            <span className="nav-tab-icon" aria-hidden>
              {tab.icon}
            </span>
            <span className="nav-tab-label-mobile">{tab.shortLabel}</span>
          </span>
        </NavLink>
      ))}
    </div>
  );
}
