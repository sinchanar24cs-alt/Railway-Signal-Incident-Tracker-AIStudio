import React, { useState } from "react";
import { UserPlus, Play, CheckCircle2, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../services/api";
import type { HandlerRecord, ReportRecord, ReportStatus } from "../types";
import { PriorityLabel, StatusLabel } from "../components/StatusTag";

interface Props {
  handlers: HandlerRecord[];
  reports: ReportRecord[];
  onRefresh: () => Promise<void>;
  onSelectReport: (reportId: string) => void;
}

export const HandlerDashboardPage: React.FC<Props> = ({
  handlers,
  reports,
  onRefresh,
  onSelectReport,
}) => {
  const [selectedHandlerId, setSelectedHandlerId] = useState<string>("ALL");
  const [notesByReport, setNotesByReport] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Handler Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [hCode, setHCode] = useState("");
  const [hName, setHName] = useState("");
  const [hRole, setHRole] = useState("Backup");
  const [hTeam, setHTeam] = useState("Signal Reserve Team");
  const [hBranch, setHBranch] = useState("Signal & Telecom");
  const [hDivision, setHDivision] = useState("DIV-NORTH");
  const [hZone, setHZone] = useState("ZONE-N");
  const [hCapacity, setHCapacity] = useState(3);

  const activeReports = reports.filter((r) => {
    if (selectedHandlerId === "ALL") return true;
    return String(r.assignment?.handler_id || "") === selectedHandlerId;
  });

  const handleToggleAvailability = async (h: HandlerRecord) => {
    setFeedback(null);
    await api.updateHandler(h.id, { is_available: h.is_available !== 1 });
    await onRefresh();
    setFeedback(`Updated availability for ${h.name}.`);
  };

  const handleStatusChange = async (r: ReportRecord, newStatus: ReportStatus) => {
    setBusyId(r.report_id);
    setFeedback(null);
    try {
      const notes = notesByReport[r.report_id] ?? r.assignment?.resolution_notes ?? "";
      const actor = r.assignment?.handler_name || "Control Room Handler";
      const res = await api.updateReportStatus(r.report_id, {
        status: newStatus,
        changed_by: actor,
        notes,
      });
      await onRefresh();
      const drainedCount = res.queue_drained?.length || 0;
      setFeedback(
        `Report ${r.report_id} moved to ${newStatus}.${
          drainedCount > 0 ? ` ${drainedCount} queued report(s) evaluated.` : ""
        }`
      );
    } catch (err: unknown) {
      setFeedback((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAddHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.addHandler({
        handler_code: hCode,
        name: hName,
        role: hRole,
        team: hTeam,
        branch: hBranch,
        division_code: hDivision,
        zone_code: hZone,
        max_capacity: Number(hCapacity),
      });
      setHCode("");
      setHName("");
      setShowAddForm(false);
      await onRefresh();
      setFeedback("New handler registered in SQLite.");
    } catch (err: unknown) {
      setFeedback((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="bg-cyan-950/40 border border-cyan-700/50 rounded-lg px-4 py-3 text-xs text-cyan-200">
          {feedback}
        </div>
      )}

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Handler Roster &amp; Capacity</h2>
            <p className="text-xs text-slate-400">
              Toggle availability to test primary-to-backup failover or capacity queuing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
          >
            <UserPlus size={14} /> {showAddForm ? "Cancel" : "Add Handler"}
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddHandler}
            className="p-4 rounded-lg bg-[#080d18] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <input
              placeholder="Handler Code (e.g. HND-N-B2)"
              value={hCode}
              onChange={(e) => setHCode(e.target.value)}
              className="font-mono text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
              required
            />
            <input
              placeholder="Full Name"
              value={hName}
              onChange={(e) => setHName(e.target.value)}
              className="text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
              required
            />
            <select
              value={hRole}
              onChange={(e) => setHRole(e.target.value)}
              className="text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="Primary">Primary</option>
              <option value="Backup">Backup</option>
              <option value="Zonal-HQ">Zonal-HQ</option>
            </select>
            <input
              placeholder="Team"
              value={hTeam}
              onChange={(e) => setHTeam(e.target.value)}
              className="text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
              required
            />
            <input
              placeholder="Branch"
              value={hBranch}
              onChange={(e) => setHBranch(e.target.value)}
              className="text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
              required
            />
            <select
              value={hDivision}
              onChange={(e) => {
                setHDivision(e.target.value);
                if (e.target.value === "DIV-NORTH") setHZone("ZONE-N");
                if (e.target.value === "DIV-WEST") setHZone("ZONE-W");
                if (e.target.value === "DIV-SOUTH") setHZone("ZONE-S");
              }}
              className="text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="DIV-NORTH">Northern Demo Division</option>
              <option value="DIV-WEST">Western Demo Division</option>
              <option value="DIV-SOUTH">Southern Demo Division</option>
            </select>
            <input
              type="number"
              min={1}
              max={25}
              value={hCapacity}
              onChange={(e) => setHCapacity(Number(e.target.value))}
              className="font-mono text-xs bg-[#111a2e] border border-slate-700 rounded px-3 py-2 text-white"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white"
            >
              Save Handler
            </button>
          </form>
        )}

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Handler</th>
                <th className="py-2.5 px-3">Role &middot; Team</th>
                <th className="py-2.5 px-3">Division / Zone</th>
                <th className="py-2.5 px-3">Workload / Capacity</th>
                <th className="py-2.5 px-3">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {handlers.map((h) => {
                const pct = Math.min(100, Math.round((h.current_load / h.max_capacity) * 100));
                return (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-100">{h.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{h.handler_code}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200">{h.role}</div>
                      <div className="text-[11px] text-slate-400">
                        {h.team} &middot; {h.branch}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {h.division_name} &middot; {h.zone_code}
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]">
                      <div className="flex items-center justify-between font-mono mb-1">
                        <span>
                          {h.current_load} / {h.max_capacity}
                        </span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-cyan-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(h)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium whitespace-nowrap ${
                          h.is_available === 1
                            ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
                            : "border-red-700/60 bg-red-950/40 text-red-300"
                        }`}
                      >
                        {h.is_available === 1 ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        {h.is_available === 1 ? "Available" : "Unavailable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Assigned Reports &amp; Resolution Workbench</h2>
          <select
            value={selectedHandlerId}
            onChange={(e) => setSelectedHandlerId(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All Handlers</option>
            {handlers.map((h) => (
              <option key={h.id} value={String(h.id)}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Report</th>
                <th className="py-2.5 px-3">Category &middot; Zone</th>
                <th className="py-2.5 px-3">Priority &middot; Status</th>
                <th className="py-2.5 px-3">Handler</th>
                <th className="py-2.5 px-3">Resolution Notes</th>
                <th className="py-2.5 px-3 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {activeReports.map((r) => {
                const noteVal = notesByReport[r.report_id] ?? r.assignment?.resolution_notes ?? "";
                const disabled = busyId === r.report_id;
                return (
                  <tr key={r.report_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onSelectReport(r.report_id)}
                        className="font-mono font-semibold text-cyan-300 hover:underline"
                      >
                        {r.report_id}
                      </button>
                      <div className="font-mono text-[11px] text-slate-400">
                        {r.station_code} / {r.incident_code}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-100">{r.category}</div>
                      <div className="text-[11px] text-slate-400">{r.zone_name}</div>
                    </td>
                    <td className="py-2.5 px-3 space-y-1">
                      <div>
                        <PriorityLabel priority={r.priority} />
                      </div>
                      <div>
                        <StatusLabel status={r.status} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {r.assignment?.handler_name || "Queued"}
                    </td>
                    <td className="py-2.5 px-3 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="Add investigation / fix notes..."
                        value={noteVal}
                        disabled={r.status === "Resolved"}
                        onChange={(e) =>
                          setNotesByReport((prev) => ({ ...prev, [r.report_id]: e.target.value }))
                        }
                        className="w-full text-xs bg-[#080d18] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {r.status === "Assigned" && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleStatusChange(r, "In Progress")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-cyan-700/60 bg-cyan-950/50 text-xs text-cyan-200 hover:bg-cyan-900/50 whitespace-nowrap"
                          >
                            <Play size={12} /> Start Investigation
                          </button>
                        )}
                        {r.status !== "Resolved" && r.status !== "Pending" && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleStatusChange(r, "Resolved")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-700/60 bg-emerald-950/50 text-xs text-emerald-200 hover:bg-emerald-900/50 whitespace-nowrap"
                          >
                            <CheckCircle2 size={12} /> Resolve
                          </button>
                        )}
                        {r.status === "Pending" && (
                          <span className="text-[11px] text-amber-300">Awaiting Dispatch Slot</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
