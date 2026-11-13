import React, { useState } from "react";
import { Play, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../services/api";
import type { TestCaseResult } from "../types";

export const TestCentrePage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    tests: TestCaseResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runTests();
      setSummary(res);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Automated Verification Test Centre (20 Cases)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Executes live Python integration tests against isolated SQLite transactions covering DFA, Regex, Classification, Routing, Failover, Escalation, Queuing, and Duplicate Prevention.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold text-white transition-colors whitespace-nowrap disabled:opacity-50"
        >
          <Play size={15} />
          {running ? "Executing 20 Tests..." : "Run All 20 Integration Tests"}
        </button>
      </section>

      {error && (
        <div className="bg-red-950/40 border border-red-700/60 rounded-lg p-4 text-xs text-red-200">
          Test execution error: {error}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Executed Tests</div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
                {summary.total}
              </div>
            </div>
            <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Passed</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
                {summary.passed}
              </div>
            </div>
            <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Failed</div>
              <div className="text-2xl font-bold text-red-400 font-mono tabular-nums mt-1">
                {summary.failed}
              </div>
            </div>
          </div>

          <section className="bg-[#111a2e] border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Test ID</th>
                    <th className="py-2.5 px-3">Scenario Description</th>
                    <th className="py-2.5 px-3">Input</th>
                    <th className="py-2.5 px-3">Expected Result</th>
                    <th className="py-2.5 px-3">Actual Result</th>
                    <th className="py-2.5 px-3 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summary.tests.map((t) => (
                    <tr key={t.test_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-cyan-300 whitespace-nowrap">
                        {t.test_id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-100">{t.description}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{t.input}</td>
                      <td className="py-2.5 px-3 text-slate-300">{t.expected}</td>
                      <td className="py-2.5 px-3 text-slate-300">{t.actual}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {t.status === "PASS" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 size={14} /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                            <XCircle size={14} /> FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
