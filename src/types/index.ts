export type ReportStatus = "Pending" | "Assigned" | "In Progress" | "Resolved";
export type PriorityLevel = "Low" | "Medium" | "High" | "Critical";
export type IncidentCategory =
  | "Signal-Failure"
  | "Track-Obstruction"
  | "Electrical"
  | "Minor-Delay"
  | "Test-Entry";

export interface DFAStep {
  step: number;
  input_char: string;
  from_state: string;
  to_state: string;
  transition_valid: boolean;
}

export interface DFAResult {
  method: "DFA";
  target: "station_code" | "incident_code";
  input: string;
  valid: boolean;
  initial_state: string;
  final_state: string;
  accepting_states: string[];
  steps: DFAStep[];
  reason: string;
  definition?: {
    name: string;
    pattern_description: string;
    states: string[];
    alphabet: string[];
    initial_state: string;
    accepting_states: string[];
    transitions: Array<{ from: string; symbol: string; to: string }>;
  };
}

export interface RegexResult {
  method: "Regex";
  target: "station_code" | "incident_code";
  input: string;
  pattern: string;
  valid: boolean;
  reason: string;
}

export interface ValidationComparisonResponse {
  overall_valid: boolean;
  station: {
    dfa: DFAResult;
    regex: RegexResult;
    agree: boolean;
    valid: boolean;
  };
  incident: {
    dfa: DFAResult;
    regex: RegexResult;
    agree: boolean;
    valid: boolean;
  };
  errors: string[];
}

export interface MatchedPattern {
  category: IncidentCategory;
  matched_by_code: boolean;
  matched_keywords: string[];
  rule_label: string;
  priority_rank: number;
}

export interface ClassificationResult {
  classified?: boolean;
  category: IncidentCategory | null;
  matched_patterns: MatchedPattern[];
  conflict_detected: boolean;
  priority_rule_applied: string;
  reason: string;
}

export interface ReportRecord {
  report_id: string;
  station_code: string;
  station_name: string;
  incident_code: string;
  description: string;
  urgency: PriorityLevel;
  priority: PriorityLevel;
  reporter_name: string;
  submitted_at: string;
  status: ReportStatus;
  is_sample: boolean;
  created_at: string;
  zone_code: string;
  zone_name: string;
  division_name: string;
  category: IncidentCategory | null;
  classification: ClassificationResult | null;
  validation: {
    station_dfa_valid: boolean;
    station_regex_valid: boolean;
    station_agree: boolean;
    incident_dfa_valid: boolean;
    incident_regex_valid: boolean;
    incident_agree: boolean;
    overall_valid: boolean;
    validation_summary: string;
    dfa_trace: { station: DFAResult; incident: DFAResult };
  } | null;
  assignment: {
    handler_id: number | null;
    handler_code: string | null;
    handler_name: string | null;
    handler_role: string | null;
    handler_team: string | null;
    assignment_type: string;
    assignment_status: string;
    resolution_notes: string;
    assigned_at: string;
    resolved_at: string | null;
  } | null;
  escalation: {
    report_id: string;
    initial_division: string;
    zonal_hq_unit: string;
    zonal_handler_name: string;
    escalation_reason: string;
    priority: string;
    assignment_status: string;
    escalated_at: string;
  } | null;
  latest_dispatch_log?: {
    id: number;
    routing_key: string;
    division_name: string;
    zone_name: string;
    decision: string;
    reason: string;
    queue_order: number | null;
    logged_at: string;
  } | null;
  status_history?: Array<{
    id: number;
    old_status: string | null;
    new_status: ReportStatus;
    changed_by: string;
    notes: string;
    changed_at: string;
  }>;
  dispatch_logs?: Array<{
    id: number;
    routing_key: string;
    division_name: string;
    zone_name: string;
    decision: string;
    reason: string;
    queue_order: number | null;
    logged_at: string;
  }>;
}

export interface HandlerRecord {
  id: number;
  handler_code: string;
  name: string;
  role: string;
  team: string;
  branch: string;
  division_code: string;
  division_name: string;
  zone_code: string;
  zone_name: string;
  is_available: number;
  current_load: number;
  max_capacity: number;
  active_assignments: number;
}

export interface RoutingRuleRecord {
  id: number;
  station_prefix: string;
  station_code: string;
  station_name: string;
  division_code: string;
  division_name: string;
  zone_code: string;
  zone_name: string;
  branch: string;
  team: string;
  depot: string;
  incident_category: string;
  default_priority: PriorityLevel;
  primary_handler_id: number;
  primary_handler_name: string;
  primary_available: number;
  primary_load: number;
  primary_capacity: number;
  backup_handler_id: number;
  backup_handler_name: string;
  backup_available: number;
  backup_load: number;
  backup_capacity: number;
}

export interface EscalationRecord {
  id: number;
  report_id: string;
  station_code: string;
  incident_code: string;
  category: string;
  initial_division: string;
  zonal_hq_unit: string;
  zonal_handler_name: string;
  escalation_reason: string;
  priority: string;
  assignment_status: string;
  report_status: string;
  escalated_at: string;
}

export interface AnalyticsData {
  summary: {
    total: number;
    pending: number;
    assigned: number;
    in_progress: number;
    resolved: number;
    unresolved: number;
    escalations: number;
  };
  by_zone: Array<{ name: string; count: number }>;
  by_category: Array<{ name: string; value: number }>;
  by_priority: Array<{ name: string; value: number }>;
  monthly_trends: Array<{ month: string; total: number; resolved: number }>;
  handler_workload: Array<{
    name: string;
    role: string;
    current_load: number;
    max_capacity: number;
    is_available: number;
  }>;
}

export interface TestCaseResult {
  test_id: string;
  description: string;
  input: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
}
