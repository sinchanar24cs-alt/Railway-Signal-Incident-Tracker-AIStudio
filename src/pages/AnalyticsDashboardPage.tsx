import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { api } from "../services/api";
import type { AnalyticsData } from "../types";

const CATEGORY_COLORS = ["#06b6d4", "#f97316", "#eab308", "#3b82f6", "#22c55e"];
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#38bdf8",
};

export const AnalyticsDashboardPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-8 text-sm text-slate-400">
        Computing analytics directly from SQLite records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Operational Analytics</h2>
          <p className="text-xs text-slate-400">
            All metrics and visualizations are aggregated live from persisted SQLite tables.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-500/60"
        >
          <RefreshCw size={13} /> Refresh Metrics
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Total Reports</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {data.summary.total}
          </div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Resolved</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {data.summary.resolved}
          </div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Unresolved</div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums mt-1">
            {data.summary.unresolved}
          </div>
        </div>
        <div className="bg-[#111a2e] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Zonal HQ Escalations</div>
          <div className="text-2xl font-bold text-red-400 font-mono tabular-nums mt-1">
            {data.summary.escalations}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-white mb-4">Zone-Wise Report Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_zone}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                <Bar dataKey="count" name="Reports" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-white mb-4">Handler Workload vs Max Capacity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.handler_workload}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                <Legend />
                <Bar dataKey="current_load" name="Active Load" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max_capacity" name="Max Capacity" fill="#334155" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-white mb-4">Category-Wise Distribution (5 Classes)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.by_category}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.by_category.map((entry, idx) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-white mb-4">Priority-Wise Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.by_priority}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  label
                >
                  {data.by_priority.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PRIORITY_COLORS[entry.name] || "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="bg-[#111a2e] border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-bold text-white mb-4">Monthly Incident Trends (Total vs Resolved)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthly_trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
              <Legend />
              <Line type="monotone" dataKey="total" name="Total Submitted" stroke="#06b6d4" strokeWidth={2.5} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};
