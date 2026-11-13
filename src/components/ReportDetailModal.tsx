import React, { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import type { ReportRecord } from "../types";
import { PriorityLabel, StatusLabel } from "./StatusTag";

interface ReportDetailModalProps {
  reportId: string | null;
  onClose: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ reportId, onClose }) => {
  const [detail, setDetail] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    api
      .getReportDetail(reportId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [reportId]);

  if (!reportId) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-mono text-base font-bold text-white">{reportId}</h3>
            {detail && (
              <span className="text-xs text-slate-400">
                {detail.is_sample ? "Demonstration Seed" : "Live Submitted Record"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 hover:text-white"
          >
            <X size={14} /> Close
          </button>
        </div>

        {loading || !detail ? (
          <div className="py-8 text-sm text-slate-400">Loading complete lifecycle record...</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
                <div className="font-semibold text-slate-200 pb-1 border-b border-slate-800">
                  Incident Details
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-slate-400">Station</span>
                  <span className="font-mono text-slate-100">
                    {detail.station_code} ({detail.station_name})
                  </span>
                  <span className="text-slate-400">Incident Code</span>
                  <span className="font-mono text-cyan-300">{detail.incident_code}</span>
                  <span className="text-slate-400">Division &amp; Zone</span>
                  <span className="text-slate-200">
                    {detail.division_name} &middot; {detail.zone_name}
                  </span>
                  <span className="text-slate-400">Reporter</span>
                  <span className="text-slate-200">{detail.reporter_name}</span>
                  <span className="text-slate-400">Submitted At</span>
                  <span className="font-mono text-slate-300">{detail.submitted_at}</span>
                  <span className="text-slate-400">Priority</span>
                  <PriorityLabel priority={detail.priority} />
                  <span className="text-slate-400">Current Status</span>
                  <StatusLabel status={detail.status} />
                </div>
                <div className="pt-2 text-xs text-slate-300 border-t border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Description</span>
                  {detail.description}
                </div>
              </div>

              <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs">
                <div className="text-sm font-semibold text-slate-200 pb-1 border-b border-slate-800">
                  Automata Validation &amp; Classification
                </div>
                {detail.validation && (
                  <div className="flex items-start gap-2 text-emerald-300">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <div>
                      DFA &amp; Regex Agreement: Station ({String(detail.validation.station_agree)}),
                      Incident ({String(detail.validation.incident_agree)})
                    </div>
                  </div>
                )}
                {detail.classification && (
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-400">Assigned Category: </span>
                      <span className="font-semibold text-cyan-300">{detail.classification.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Conflict Detected: </span>
                      <span className="text-slate-200">
                        {detail.classification.conflict_detected ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Rule Applied: </span>
                      <span className="text-slate-200">{detail.classification.priority_rule_applied}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{detail.classification.reason}</p>
                  </div>
                )}
                {detail.assignment && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div>
                      <span className="text-slate-400">Handler: </span>
                      <span className="text-slate-100 font-medium">
                        {detail.assignment.handler_name || "Queued (Pending Capacity)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Assignment Type: </span>
                      <span className="text-slate-200">{detail.assignment.assignment_type}</span>
                    </div>
                    {detail.assignment.resolution_notes && (
                      <div>
                        <span className="text-slate-400">Notes: </span>
                        <span className="text-emerald-300">{detail.assignment.resolution_notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {detail.escalation && (
              <div className="bg-red-950/40 border border-red-700/60 rounded-lg p-3.5 text-xs text-red-200 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-300">
                    Zonal HQ Tier-2 Escalation ({detail.escalation.zonal_hq_unit})
                  </div>
                  <div className="mt-0.5">
                    {detail.escalation.escalation_reason} &middot; Officer:{" "}
                    {detail.escalation.zonal_handler_name}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-200 mb-2">
                Dispatch Decision History
              </div>
              <div className="divide-y divide-slate-800 text-xs">
                {(detail.dispatch_logs || []).map((log) => (
                  <div key={log.id} className="py-2 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-cyan-300">{log.decision}</span>
                      <span className="font-mono text-slate-500">{log.logged_at}</span>
                    </div>
                    <span className="text-slate-400">{log.reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-200 mb-2">Status Audit Trail</div>
              <div className="divide-y divide-slate-800 text-xs">
                {(detail.status_history || []).map((sh) => (
                  <div key={sh.id} className="py-2 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-slate-100">
                        {sh.old_status || "NEW"} &rarr; {sh.new_status}
                      </span>
                      <span className="text-slate-400"> by {sh.changed_by}</span>
                      {sh.notes ? <span className="text-slate-300"> &mdash; {sh.notes}</span> : null}
                    </div>
                    <span className="font-mono text-slate-500 shrink-0">{sh.changed_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
