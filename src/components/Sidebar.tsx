import React from "react";
import {
  FilePlus2,
  LayoutDashboard,
  UserCheck,
  Network,
  BarChart3,
  Cpu,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  TrainFront,
} from "lucide-react";

export type NavTab =
  | "submit"
  | "dashboard"
  | "handlers"
  | "routing"
  | "analytics"
  | "automata"
  | "tests";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
  { id: "submit", label: "Report Submission", icon: <FilePlus2 size={17} /> },
  { id: "dashboard", label: "User Dashboard", icon: <LayoutDashboard size={17} /> },
  { id: "handlers", label: "Handler Dashboard", icon: <UserCheck size={17} /> },
  { id: "routing", label: "Routing Management", icon: <Network size={17} /> },
  { id: "analytics", label: "Analytics Dashboard", icon: <BarChart3 size={17} /> },
  { id: "automata", label: "Automata DFA Lab", icon: <Cpu size={17} /> },
  { id: "tests", label: "Test Centre", icon: <FlaskConical size={17} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
}) => {
  return (
    <aside
      className={`bg-[#0b1220] border-r border-slate-800 flex flex-col shrink-0 transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[252px]"
      }`}
    >
      <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <TrainFront size={20} className="text-cyan-400 shrink-0" />
            <div className="truncate">
              <div className="text-sm font-bold tracking-tight text-slate-100 truncate">
                RSIT Control
              </div>
              <div className="text-xs text-slate-400 truncate">
                BCS503 &middot; BCS502
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="p-2 rounded-md border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white hover:border-slate-700 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="p-3 flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
                isActive
                  ? "bg-cyan-950/50 border-cyan-500/40 text-white"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900"
              }`}
            >
              <span className={isActive ? "text-cyan-400 shrink-0" : "shrink-0"}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="font-medium text-slate-300">Demonstration Network</div>
          <div>30 Stations &middot; 3 Divisions</div>
        </div>
      )}
    </aside>
  );
};
