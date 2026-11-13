import type {
  AnalyticsData,
  ClassificationResult,
  EscalationRecord,
  HandlerRecord,
  ReportRecord,
  ReportStatus,
  RoutingRuleRecord,
  TestCaseResult,
  ValidationComparisonResponse,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed with status ${res.status}`);
    (err as Error & { payload?: unknown }).payload = body;
    throw err;
  }
  return body as T;
}

export const api = {
  validateIdentifiers: (station_code: string, incident_code: string) =>
    request<ValidationComparisonResponse>("/validate", {
      method: "POST",
      body: JSON.stringify({ station_code, incident_code }),
    }),

  classifyIncident: (incident_code: string, description: string) =>
    request<ClassificationResult>("/classify", {
      method: "POST",
      body: JSON.stringify({ incident_code, description }),
    }),

  submitReport: (payload: {
    report_id: string;
    station_code: string;
    incident_code: string;
    description: string;
    urgency: string;
    reporter_name: string;
    submitted_at: string;
  }) =>
    request<{ message: string; report: ReportRecord; dispatch: unknown }>("/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getReports: (filters?: {
    search?: string;
    category?: string;
    zone?: string;
    priority?: string;
    status?: string;
    record_type?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== "ALL") params.set(k, v);
      });
    }
    const qs = params.toString();
    return request<{ reports: ReportRecord[]; count: number }>(`/reports${qs ? `?${qs}` : ""}`);
  },

  getReportDetail: (reportId: string) =>
    request<ReportRecord>(`/reports/${encodeURIComponent(reportId)}`),

  updateReportStatus: (
    reportId: string,
    payload: { status: ReportStatus; changed_by: string; notes: string }
  ) =>
    request<{ report: ReportRecord; queue_drained: unknown[] }>(
      `/reports/${encodeURIComponent(reportId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  getHandlers: () => request<{ handlers: HandlerRecord[] }>("/handlers"),

  addHandler: (payload: {
    handler_code: string;
    name: string;
    role: string;
    team: string;
    branch: string;
    division_code: string;
    zone_code: string;
    max_capacity: number;
  }) =>
    request<{ handler: HandlerRecord }>("/handlers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateHandler: (handlerId: number, payload: { is_available?: boolean; max_capacity?: number }) =>
    request<{ handler: HandlerRecord }>(`/handlers/${handlerId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getRouting: () =>
    request<{
      routing_rules: RoutingRuleRecord[];
      queued_reports: Array<{
        report_id: string;
        station_code: string;
        incident_code: string;
        priority: string;
        submitted_at: string;
        category: string;
        assignment_type: string;
        queue_order: number | null;
        reason: string;
      }>;
      dispatch_logs: Array<{
        id: number;
        report_id: string;
        routing_key: string;
        division_name: string;
        zone_name: string;
        decision: string;
        reason: string;
        queue_order: number | null;
        logged_at: string;
      }>;
      divisions: Array<{ id: number; division_code: string; division_name: string; zonal_hq_unit: string }>;
      zones: Array<{ id: number; zone_code: string; zone_name: string }>;
      stations: Array<{
        station_code: string;
        station_prefix: string;
        station_name: string;
        division_code: string;
        zone_code: string;
      }>;
    }>("/routing"),

  updateRoutingRule: (
    ruleId: number,
    payload: { primary_handler_id?: number; backup_handler_id?: number; default_priority?: string }
  ) =>
    request<{ message: string }>(`/routing/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  processQueue: () =>
    request<{ processed: number; results: unknown[] }>("/dispatch/process-queue", {
      method: "POST",
    }),

  getEscalations: () => request<{ escalations: EscalationRecord[] }>("/escalations"),

  getAnalytics: () => request<AnalyticsData>("/analytics"),

  runTests: () =>
    request<{ total: number; passed: number; failed: number; tests: TestCaseResult[] }>("/tests/run", {
      method: "POST",
    }),

  resetDemo: () =>
    request<{ message: string }>("/demo/reset", {
      method: "POST",
    }),
};
