import { Activity, BarChart3, BookOpen, Gauge, LayoutDashboard, Settings, Table2, Wallet } from 'lucide-react';
import { TrueMarketsIcon } from './TrueMarketsLogo';

const navItems = [
  { icon: LayoutDashboard, active: true, label: 'Dashboard' },
  { icon: BarChart3, active: false, label: 'Analytics' },
  { icon: Wallet, active: false, label: 'Liquidity' },
  { icon: BookOpen, active: false, label: 'Books' },
  { icon: Table2, active: false, label: 'Tables' },
  { icon: Gauge, active: false, label: 'Risk' },
  { icon: Activity, active: false, label: 'Feeds' },
  { icon: Settings, active: false, label: 'Settings' },
];

export function AppSidebar() {
  return (
    <aside className="flex h-full w-[64px] flex-shrink-0 flex-col items-center border-r border-divider/70 bg-[#0B0A20]/95 py-4">
      <div className="mb-6 grid h-9 w-9 place-items-center rounded-lg bg-[#E84056]/15 text-[#FF5B6D]">
        <TrueMarketsIcon size={20} />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-3">
        {navItems.map(({ icon: Icon, active, label }) => (
          <button
            key={label}
            title={label}
            className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${
              active
                ? 'bg-[#4F7DFF]/18 text-[#6F8DFF]'
                : 'text-[#62658D] hover:bg-[#17162F] hover:text-[#A7A9D2]'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </nav>

      <div className="h-8 w-8 rounded-full border border-divider bg-panel-secondary" />
    </aside>
  );
}
