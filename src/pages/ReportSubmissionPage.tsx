import React, { useState } from "react";
import { Send, ShieldCheck, AlertOctagon, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import { DFADiagram } from "../components/DFADiagram";
import { PriorityLabel, StatusLabel } from "../components/StatusTag";
import type {
  ClassificationResult,
  PriorityLevel,
  ReportRecord,
  ValidationComparisonResponse,
} from "../types";

interface Props {
  onSubmitted: () => void;
  onSelectReport: (reportId: string) => void;
}

const makeReportId = () => {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${ymd}-${rand}`;
};

export const ReportSubmissionPage: React.FC<Props> = ({ onSubmitted, onSelectReport }) => {
  const [reportId, setReportId] = useState(makeReportId());
  const [stationCode, setStationCode] = useState("NTH01");
  const [incidentCode, setIncidentCode] = useState("SIG04");
  const [description, setDescription] = useState("Main home signal aspect stuck on red at junction.");
  const [urgency, setUrgency] = useState<PriorityLevel>("High");
  const [reporterName, setReporterName] = useState("SM Vikram Rao");
  const [submittedAt, setSubmittedAt] = useState(new Date().toISOString().slice(0, 19));

  const [validation, setValidation] = useState<ValidationComparisonResponse | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [submittedResult, setSubmittedResult] = useState<ReportRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleValidateOnly = async () => {
    setErrorMsg(null);
    setClassification(null);
    setSubmittedResult(null);
    setBusy(true);
    try {
      const val = await api.validateIdentifiers(stationCode, incidentCode);
      setValidation(val);
      if (val.overall_valid) {
        try {
          const cls = await api.classifyIncident(incidentCode, description);
          setClassification(cls);
        } catch (err: unknown) {
          const payload = (err as { payload?: ClassificationResult }).payload;
          if (payload) setClassification(payload);
          setErrorMsg((err as Error).message);
        }
      } else {
        setErrorMsg(val.errors.join(" | "));
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmittedResult(null);
    setBusy(true);
    try {
      const val = await api.validateIdentifiers(stationCode, incidentCode);
      setValidation(val);
      const res = await api.submitReport({
        report_id: reportId,
        station_code: stationCode,
        incident_code: incidentCode,
        description,
        urgency,
        reporter_name: reporterName,
        submitted_at: submittedAt,
      });
      setSubmittedResult(res.report);
      setClassification(res.report.classification);
      setReportId(makeReportId());
      setSubmittedAt(new Date().toISOString().slice(0, 19));
      onSubmitted();
    } catch (err: unknown) {
      const eObj = err as Error & {
        payload?: {
          validation?: ValidationComparisonResponse;
          classification?: ClassificationResult;
        };
      };
      if (eObj.payload?.validation) setValidation(eObj.payload.validation);
      if (eObj.payload?.classification) setClassification(eObj.payload.classification);
      setErrorMsg(eObj.message);
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (st: string, inc: string, desc: string, urg: PriorityLevel) => {
    setStationCode(st);
    setIncidentCode(inc);
    setDescription(desc);
    setUrgency(urg);
    setErrorMsg(null);
    setSubmittedResult(null);
  };

  return (
    <div className="space-y-6">
      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Submit Incident Report</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifiers undergo independent DFA and regular expression verification prior to classification and network dispatch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                applyPreset("NTH01", "SIG01", "Interlocking signal red lamp failure on main line", "Critical")
              }
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
            >
              Critical Signal
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  "WST01",
                  "SIG05",
                  "Signal relay fault causing electrical short circuit and minor delay",
                  "High"
                )
              }
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
            >
              Conflict Pattern
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset("XYZ45", "TRK14", "Track boulder obstruction at unmapped station", "High")
              }
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
            >
              Unknown Zone
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset("NTH01", "SIG75", "Unmapped numeric range test", "Low")
              }
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
            >
              Unmapped Code
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset("AB12", "XYZ99", "Malformed station and incident identifiers", "Low")
              }
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
            >
              Invalid DFA
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Unique Report ID</label>
              <input
                className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Station Code <span className="font-mono text-slate-400">([A-Z]&#123;3&#125;[0-9]&#123;2&#125;)</span>
              </label>
              <input
                className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value)}
                placeholder="e.g. NTH01"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Incident Code <span className="font-mono text-slate-400">((SIG|TRK|ELE)[0-9]&#123;2&#125;)</span>
              </label>
              <input
                className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={incidentCode}
                onChange={(e) => setIncidentCode(e.target.value)}
                placeholder="e.g. SIG04"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Urgency Level</label>
              <select
                className="w-full text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as PriorityLevel)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical (Escalates to Zonal HQ)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Reporter Name</label>
              <input
                className="w-full text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Submission Date &amp; Time</label>
              <input
                className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Incident Description</label>
            <textarea
              rows={3}
              className="w-full text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleValidateOnly}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              Validate &amp; Preview Classification
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold text-white transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Send size={15} />
              {busy ? "Processing Pipeline..." : "Submit, Classify & Dispatch"}
            </button>
          </div>
        </form>
      </section>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-700/60 rounded-lg p-4 flex items-start gap-3 text-sm text-red-200">
          <AlertOctagon size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-300">Submission Rejected</div>
            <div className="text-xs mt-1">{errorMsg}</div>
          </div>
        </div>
      )}

      {submittedResult && (
        <div className="bg-emerald-950/35 border border-emerald-700/60 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-sm text-emerald-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Report <span className="font-mono">{submittedResult.report_id}</span> persisted and routed
              </div>
              <div className="text-xs text-emerald-200/90 flex flex-wrap items-center gap-2">
                <span>Category: {submittedResult.category}</span>
                <span>&middot;</span>
                <PriorityLabel priority={submittedResult.priority} />
                <span>&middot;</span>
                <StatusLabel status={submittedResult.status} />
                <span>&middot;</span>
                <span>
                  Handler: {submittedResult.assignment?.handler_name || "Queued / Fallback"} (
                  {submittedResult.assignment?.assignment_type})
                </span>
                {submittedResult.escalation && (
                  <>
                    <span>&middot;</span>
                    <span className="text-red-300 font-semibold">
                      Escalated to {submittedResult.escalation.zonal_hq_unit}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectReport(submittedResult.report_id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-600/60 bg-emerald-900/40 text-xs font-semibold text-emerald-100 hover:bg-emerald-800/50 whitespace-nowrap"
          >
            Inspect Full Lifecycle <ArrowRight size={13} />
          </button>
        </div>
      )}

      {validation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">DFA vs Regex Verification</h3>
              <span
                className={`text-xs font-semibold ${
                  validation.overall_valid ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {validation.overall_valid ? "Accepted & Agreed" : "Rejected"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-[#080d18] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Station Code: <span className="font-mono text-cyan-300">{validation.station.dfa.input || "(empty)"}</span>
                  </span>
                  <span className="font-mono text-slate-300">
                    DFA={String(validation.station.dfa.valid)} ({validation.station.dfa.final_state}) &middot; Regex={String(validation.station.regex.valid)} &middot; Agree={String(validation.station.agree)}
                  </span>
                </div>
                <div className="text-slate-400">{validation.station.dfa.reason}</div>
              </div>

              <div className="p-3 rounded bg-[#080d18] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Incident Code: <span className="font-mono text-cyan-300">{validation.incident.dfa.input || "(empty)"}</span>
                  </span>
                  <span className="font-mono text-slate-300">
                    DFA={String(validation.incident.dfa.valid)} ({validation.incident.dfa.final_state}) &middot; Regex={String(validation.incident.regex.valid)} &middot; Agree={String(validation.incident.agree)}
                  </span>
                </div>
                <div className="text-slate-400">{validation.incident.dfa.reason}</div>
              </div>
            </div>

            <div className="space-y-3">
              <DFADiagram trace={validation.station.dfa} type="station" />
              <DFADiagram trace={validation.incident.dfa} type="incident" />
            </div>
          </section>

          <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">DFA Trace &amp; Classification</h3>
              {classification && (
                <span className="text-xs font-semibold text-cyan-300">
                  {classification.category || "Unclassified"}
                </span>
              )}
            </div>

            {classification && (
              <div className="p-3.5 rounded bg-[#080d18] border border-slate-800 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Rule Applied: </span>
                  <span className="text-slate-100 font-medium">{classification.priority_rule_applied}</span>
                </div>
                <div>
                  <span className="text-slate-400">Conflict Detected: </span>
                  <span className="text-slate-100 font-medium">
                    {classification.conflict_detected ? "Yes (Multiple Patterns Matched)" : "No"}
                  </span>
                </div>
                <p className="text-slate-300">{classification.reason}</p>
                {classification.matched_patterns.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="text-slate-400 font-medium">All Matching Patterns:</div>
                    {classification.matched_patterns.map((m) => (
                      <div key={m.category} className="flex items-center justify-between text-slate-300">
                        <span>
                          Rank #{m.priority_rank}: <strong className="text-white">{m.category}</strong>
                        </span>
                        <span className="font-mono text-slate-400">
                          code={String(m.matched_by_code)} &middot; kw=[{m.matched_keywords.join(", ")}]
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300">Incident Code DFA Step Trace</div>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Step</th>
                      <th className="py-2 px-3">Char</th>
                      <th className="py-2 px-3">From</th>
                      <th className="py-2 px-3">To</th>
                      <th className="py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {validation.incident.dfa.steps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-slate-500">
                          No input characters consumed.
                        </td>
                      </tr>
                    ) : (
                      validation.incident.dfa.steps.map((s) => (
                        <tr key={s.step}>
                          <td className="py-1.5 px-3">{s.step}</td>
                          <td className="py-1.5 px-3 text-cyan-300">{s.input_char}</td>
                          <td className="py-1.5 px-3">{s.from_state}</td>
                          <td className="py-1.5 px-3">{s.to_state}</td>
                          <td className={`py-1.5 px-3 ${s.transition_valid ? "text-emerald-400" : "text-red-400"}`}>
                            {s.transition_valid ? "VALID" : "TRAP"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
