import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { api } from "../services/api";
import { DFADiagram } from "../components/DFADiagram";
import type { ValidationComparisonResponse } from "../types";

export const AutomataLabPage: React.FC = () => {
  const [stationInput, setStationInput] = useState("ABC12");
  const [incidentInput, setIncidentInput] = useState("SIG01");
  const [result, setResult] = useState<ValidationComparisonResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const runSimulation = async (st = stationInput, inc = incidentInput) => {
    setBusy(true);
    try {
      const res = await api.validateIdentifiers(st, inc);
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    runSimulation("ABC12", "SIG01");
  }, []);

  const samples = [
    { label: "Valid: ABC12 / SIG01", st: "ABC12", inc: "SIG01" },
    { label: "Valid: XYZ45 / TRK12", st: "XYZ45", inc: "TRK12" },
    { label: "Invalid Station: AB12", st: "AB12", inc: "ELE99" },
    { label: "Invalid Lowercase: abc12", st: "abc12", inc: "SIG01" },
    { label: "Invalid Prefix: XYZ12", st: "NTH01", inc: "XYZ12" },
    { label: "Too Long: ABC123 / TRK123", st: "ABC123", inc: "TRK123" },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">BCS503 Automata DFA &amp; Regex Simulator</h2>
            <p className="text-xs text-slate-400">
              Inspect step-by-step state transitions, dead-state traps, and equivalence between DFA and regular expressions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setStationInput(s.st);
                  setIncidentInput(s.inc);
                  runSimulation(s.st, s.inc);
                }}
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50 whitespace-nowrap"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Station Input (<span className="font-mono">^[A-Z]&#123;3&#125;[0-9]&#123;2&#125;$</span>)
            </label>
            <input
              value={stationInput}
              onChange={(e) => setStationInput(e.target.value)}
              className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Incident Input (<span className="font-mono">^(SIG|TRK|ELE)[0-9]&#123;2&#125;$</span>)
            </label>
            <input
              value={incidentInput}
              onChange={(e) => setIncidentInput(e.target.value)}
              className="w-full font-mono text-sm bg-[#080d18] border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => runSimulation()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold text-white whitespace-nowrap"
          >
            <Play size={15} /> Simulate Automata
          </button>
        </div>
      </section>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(["station", "incident"] as const).map((kind) => {
            const block = result[kind];
            return (
              <section key={kind} className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">
                    {kind === "station" ? "Station Code Automaton" : "Incident Code Automaton"}
                  </h3>
                  <span
                    className={`text-xs font-semibold ${
                      block.valid ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {block.valid ? "ACCEPTED" : "REJECTED"} &middot; Agreement: {String(block.agree)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#080d18] border border-slate-800 rounded-lg p-3">
                  <div>
                    <div className="text-slate-400">DFA Outcome</div>
                    <div className="font-mono text-slate-100 mt-0.5">
                      valid={String(block.dfa.valid)} &middot; final={block.dfa.final_state}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Regex Outcome</div>
                    <div className="font-mono text-slate-100 mt-0.5">
                      valid={String(block.regex.valid)} &middot; {block.regex.pattern}
                    </div>
                  </div>
                  <div className="col-span-2 text-slate-300 border-t border-slate-800 pt-2">
                    {block.dfa.reason}
                  </div>
                </div>

                <DFADiagram trace={block.dfa} type={kind} />

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="py-2 px-3">Step</th>
                        <th className="py-2 px-3">Char</th>
                        <th className="py-2 px-3">Current State</th>
                        <th className="py-2 px-3">Next State</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {block.dfa.steps.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 px-3 text-slate-500">
                            Empty input &mdash; halted in {block.dfa.initial_state}
                          </td>
                        </tr>
                      ) : (
                        block.dfa.steps.map((st) => (
                          <tr key={st.step}>
                            <td className="py-1.5 px-3">{st.step}</td>
                            <td className="py-1.5 px-3 text-cyan-300">{st.input_char}</td>
                            <td className="py-1.5 px-3">{st.from_state}</td>
                            <td className="py-1.5 px-3">{st.to_state}</td>
                            <td
                              className={`py-1.5 px-3 ${
                                st.transition_valid ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {st.transition_valid ? "OK" : "DEAD"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
