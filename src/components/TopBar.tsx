import React, { useState } from "react";
import { Bell, RotateCcw, Menu } from "lucide-react";
import type { ReportRecord } from "../types";
import { PriorityLabel } from "./StatusTag";

interface TopBarProps {
  reports: ReportRecord[];
  activeTitle: string;
  onResetDemo: () => Promise<void>;
  onSelectReport: (reportId: string) => void;
  onToggleMobileSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  reports,
  activeTitle,
  onResetDemo,
  onSelectReport,
  onToggleMobileSidebar,
}) => {
  const [openNotif, setOpenNotif] = useState(false);
  const [resetting, setResetting] = useState(false);

  const activeAlerts = reports.filter(
    (r) => (r.priority === "Critical" || r.status === "Pending") && r.status !== "Resolved"
  );

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemo();
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="h-16 bg-[#0b1220] border-b border-slate-800 px-6 flex items-center justify-between gap-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle sidebar"
          className="md:hidden p-2 rounded-md border border-slate-800 text-slate-300 hover:text-white"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100 whitespace-nowrap truncate">
            <span>RAILWAY SIGNAL INCIDENT TRACKER</span>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <span className="text-cyan-400 font-medium hidden sm:inline">{activeTitle}</span>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block truncate">
            Report. Validate. Classify. Dispatch. Resolve.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 relative">
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <RotateCcw size={14} />
          {resetting ? "Resetting..." : "Reset Demo"}
        </button>

        <button
          type="button"
          onClick={() => setOpenNotif(!openNotif)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Bell size={14} />
          <span>Alerts ({activeAlerts.length})</span>
        </button>

        {openNotif && (
          <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-[#0f172a] border border-slate-700 rounded-lg shadow-2xl z-50 p-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">
                Active Escalations &amp; Queue Alerts
              </span>
              <button
                type="button"
                onClick={() => setOpenNotif(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {activeAlerts.length === 0 ? (
              <div className="py-4 text-xs text-slate-400 text-center">
                No pending or critical alerts right now.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {activeAlerts.slice(0, 8).map((r) => (
                  <button
                    key={r.report_id}
                    type="button"
                    onClick={() => {
                      setOpenNotif(false);
                      onSelectReport(r.report_id);
                    }}
                    className="w-full text-left py-2.5 px-1.5 hover:bg-slate-800/60 rounded transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-100">
                        {r.report_id}
                      </span>
                      <PriorityLabel priority={r.priority} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {r.station_code} &middot; {r.category || "Unclassified"} &middot; {r.status}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
