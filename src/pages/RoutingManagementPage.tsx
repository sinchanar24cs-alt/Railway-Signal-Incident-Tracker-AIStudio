import React, { useEffect, useState } from "react";
import { RefreshCw, Save, ShieldAlert } from "lucide-react";
import { api } from "../services/api";
import type { EscalationRecord, HandlerRecord, PriorityLevel, RoutingRuleRecord } from "../types";
import { PriorityLabel } from "../components/StatusTag";

interface Props {
  handlers: HandlerRecord[];
  onRefreshGlobal: () => Promise<void>;
  onSelectReport: (reportId: string) => void;
}

export const RoutingManagementPage: React.FC<Props> = ({
  handlers,
  onRefreshGlobal,
  onSelectReport,
}) => {
  const [rules, setRules] = useState<RoutingRuleRecord[]>([]);
  const [queued, setQueued] = useState<
    Array<{
      report_id: string;
      station_code: string;
      incident_code: string;
      priority: string;
      submitted_at: string;
      category: string;
      assignment_type: string;
      queue_order: number | null;
      reason: string;
    }>
  >([]);
  const [logs, setLogs] = useState<
    Array<{
      id: number;
      report_id: string;
      routing_key: string;
      division_name: string;
      zone_name: string;
      decision: string;
      reason: string;
      queue_order: number | null;
      logged_at: string;
    }>
  >([]);
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);
  const [divFilter, setDivFilter] = useState("ALL");
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editPrimary, setEditPrimary] = useState<number>(0);
  const [editBackup, setEditBackup] = useState<number>(0);
  const [editPriority, setEditPriority] = useState<PriorityLevel>("High");
  const [msg, setMsg] = useState<string | null>(null);

  const loadRouting = async () => {
    const [rt, esc] = await Promise.all([api.getRouting(), api.getEscalations()]);
    setRules(rt.routing_rules);
    setQueued(rt.queued_reports);
    setLogs(rt.dispatch_logs);
    setEscalations(esc.escalations);
  };

  useEffect(() => {
    loadRouting();
  }, [handlers]);

  const startEdit = (r: RoutingRuleRecord) => {
    setEditingRuleId(r.id);
    setEditPrimary(r.primary_handler_id);
    setEditBackup(r.backup_handler_id);
    setEditPriority(r.default_priority);
  };

  const saveEdit = async (ruleId: number) => {
    await api.updateRoutingRule(ruleId, {
      primary_handler_id: editPrimary,
      backup_handler_id: editBackup,
      default_priority: editPriority,
    });
    setEditingRuleId(null);
    await loadRouting();
    setMsg(`Updated routing rule #${ruleId}.`);
  };

  const handleDrainQueue = async () => {
    const res = await api.processQueue();
    await loadRouting();
    await onRefreshGlobal();
    setMsg(`Processed ${res.processed} queued report(s).`);
  };

  const visibleRules = rules.filter((r) => divFilter === "ALL" || r.division_code === divFilter);

  return (
    <div className="space-y-6">
      {msg && (
        <div className="bg-cyan-950/40 border border-cyan-700/50 rounded-lg px-4 py-3 text-xs text-cyan-200">
          {msg}
        </div>
      )}

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">
              30-Station Network Routing Table (3 Divisions)
            </h2>
            <p className="text-xs text-slate-400">
              Demonstration railway station mapping with primary/backup handler assignment and capacity metrics.
            </p>
          </div>
          <select
            value={divFilter}
            onChange={(e) => setDivFilter(e.target.value)}
            className="text-xs bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            <option value="ALL">All 3 Divisions (30 Stations)</option>
            <option value="DIV-NORTH">Northern Demo Division (10)</option>
            <option value="DIV-WEST">Western Demo Division (10)</option>
            <option value="DIV-SOUTH">Southern Demo Division (10)</option>
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-[420px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Prefix / Code</th>
                <th className="py-2.5 px-3">Demo Station</th>
                <th className="py-2.5 px-3">Division &middot; Zone</th>
                <th className="py-2.5 px-3">Branch &middot; Team &middot; Depot</th>
                <th className="py-2.5 px-3">Primary Handler</th>
                <th className="py-2.5 px-3">Backup Handler</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3 text-right">Rule Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleRules.map((r) => {
                const isEditing = editingRuleId === r.id;
                return (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono">
                      <span className="text-slate-400">{r.station_prefix}</span> &rarr;{" "}
                      <span className="text-cyan-300 font-semibold">{r.station_code}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-200">{r.station_name}</td>
                    <td className="py-2 px-3 text-slate-300">
                      <div>{r.division_name}</div>
                      <div className="text-[11px] text-slate-500">{r.zone_name}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      <div>{r.branch}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.team} &middot; {r.depot}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={editPrimary}
                          onChange={(e) => setEditPrimary(Number(e.target.value))}
                          className="text-xs bg-[#080d18] border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          {handlers.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          <div className="text-slate-200">{r.primary_handler_name}</div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {r.primary_available ? "Avail" : "Unavail"} &middot; {r.primary_load}/{r.primary_capacity}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={editBackup}
                          onChange={(e) => setEditBackup(Number(e.target.value))}
                          className="text-xs bg-[#080d18] border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          {handlers.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          <div className="text-slate-200">{r.backup_handler_name}</div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {r.backup_available ? "Avail" : "Unavail"} &middot; {r.backup_load}/{r.backup_capacity}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                          className="text-xs bg-[#080d18] border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      ) : (
                        <PriorityLabel priority={r.default_priority} />
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => saveEdit(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 text-xs font-medium text-white"
                        >
                          <Save size={12} /> Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white">Queued &amp; Fallback Reports ({queued.length})</h3>
            <button
              type="button"
              onClick={handleDrainQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-500/60"
            >
              <RefreshCw size={13} /> Process Queue
            </button>
          </div>
          {queued.length === 0 ? (
            <div className="py-6 text-xs text-slate-400 text-center">
              No reports currently waiting in dispatch or fallback queues.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {queued.map((q) => (
                <div key={q.report_id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectReport(q.report_id)}
                      className="font-mono font-semibold text-cyan-300 hover:underline"
                    >
                      {q.report_id}
                    </button>
                    <span className="font-mono text-slate-400">
                      {q.assignment_type} {q.queue_order ? `#${q.queue_order}` : ""}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    {q.station_code} / {q.incident_code} &middot; {q.category} &middot; {q.priority}
                  </div>
                  <div className="text-slate-500">{q.reason}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-400" /> Zonal HQ Escalations ({escalations.length})
            </h3>
          </div>
          {escalations.length === 0 ? (
            <div className="py-6 text-xs text-slate-400 text-center">
              No Zonal HQ escalations recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {escalations.map((e) => (
                <div key={e.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectReport(e.report_id)}
                      className="font-mono font-semibold text-red-300 hover:underline"
                    >
                      {e.report_id}
                    </button>
                    <span className="font-mono text-slate-400">
                      {e.initial_division} &rarr; {e.zonal_hq_unit}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    {e.station_code} &middot; {e.category} &middot; Officer: {e.zonal_handler_name}
                  </div>
                  <div className="text-slate-400">{e.escalation_reason}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-3">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">
          Recent Routing &amp; Dispatch Decisions
        </h3>
        <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-64">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">Report ID</th>
                <th className="py-2 px-3">Key</th>
                <th className="py-2 px-3">Division / Zone</th>
                <th className="py-2 px-3">Decision</th>
                <th className="py-2 px-3">Reason</th>
                <th className="py-2 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 px-3 font-mono text-cyan-300">{l.report_id}</td>
                  <td className="py-2 px-3 font-mono">{l.routing_key}</td>
                  <td className="py-2 px-3 text-slate-300">
                    {l.division_name} &middot; {l.zone_name}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-100">{l.decision}</td>
                  <td className="py-2 px-3 text-slate-400">{l.reason}</td>
                  <td className="py-2 px-3 font-mono text-slate-500">{l.logged_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
