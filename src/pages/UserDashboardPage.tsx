import React, { useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import type { ReportRecord } from "../types";
import { PriorityLabel, StatusLabel } from "../components/StatusTag";

interface Props {
  reports: ReportRecord[];
  onSelectReport: (reportId: string) => void;
  onGoSubmit: () => void;
}

export const UserDashboardPage: React.FC<Props> = ({ reports, onSelectReport, onGoSubmit }) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [recordType, setRecordType] = useState<"ALL" | "live" | "sample">("ALL");

  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((r) => r.status === "Pending").length,
      assigned: reports.filter((r) => r.status === "Assigned" || r.status === "In Progress").length,
      resolved: reports.filter((r) => r.status === "Resolved").length,
    };
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (q) {
        const hay = `${r.report_id} ${r.station_code} ${r.incident_code} ${r.reporter_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (zoneFilter !== "ALL" && r.zone_code !== zoneFilter) return false;
      if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (recordType === "live" && r.is_sample) return false;
      if (recordType === "sample" && !r.is_sample) return false;
      return true;
    });
  }, [reports, search, categoryFilter, zoneFilter, priorityFilter, statusFilter, recordType]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400">Total Reports</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">{stats.total}</div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400">Pending / Queued</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono tabular-nums">{stats.pending}</div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400">Assigned &amp; Active</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono tabular-nums">{stats.assigned}</div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400">Resolved</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono tabular-nums">{stats.resolved}</div>
        </div>
      </div>

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Incident History &amp; Tracking</h2>
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {reports.length} persisted database records
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#080d18] border border-slate-800 rounded-md">
            {(["ALL", "live", "sample"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRecordType(mode)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  recordType === mode
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "ALL" ? "All Records" : mode === "live" ? "Live Submitted" : "Demo Seed"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search Report ID or Station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#080d18] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All Categories</option>
            <option value="Signal-Failure">Signal-Failure</option>
            <option value="Track-Obstruction">Track-Obstruction</option>
            <option value="Electrical">Electrical</option>
            <option value="Minor-Delay">Minor-Delay</option>
            <option value="Test-Entry">Test-Entry</option>
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All Zones</option>
            <option value="ZONE-N">Northern Demo Zone</option>
            <option value="ZONE-W">Western Demo Zone</option>
            <option value="ZONE-S">Southern Demo Zone</option>
            <option value="ZONE-FALLBACK">Central Fallback Queue</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Report ID</th>
                <th className="py-2.5 px-3">Station &middot; Code</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Assigned Handler</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-slate-400">
                    <div>No incident reports match the active filters.</div>
                    <button
                      type="button"
                      onClick={onGoSubmit}
                      className="mt-2 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white"
                    >
                      Submit New Incident Report
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.report_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-semibold text-slate-100">{r.report_id}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.is_sample ? "Demo Seed" : "Live"} &middot; {r.submitted_at}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-semibold text-cyan-300">{r.station_code}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="font-mono text-slate-200">{r.incident_code}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{r.category || "Unclassified"}</td>
                    <td className="py-2.5 px-3 text-slate-300">{r.zone_name}</td>
                    <td className="py-2.5 px-3">
                      <PriorityLabel priority={r.priority} />
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusLabel status={r.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200">{r.assignment?.handler_name || "Queued"}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.assignment?.assignment_type}
                        {r.escalation ? ` · HQ: ${r.escalation.zonal_hq_unit}` : ""}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReport(r.report_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
