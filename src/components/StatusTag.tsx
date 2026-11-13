import React from "react";
import { AlertTriangle, CheckCircle2, Clock, CircleAlert, ArrowUpRight, Wrench } from "lucide-react";
import type { PriorityLevel, ReportStatus } from "../types";

export const PriorityLabel: React.FC<{ priority: PriorityLevel | string }> = ({ priority }) => {
  switch (priority) {
    case "Critical":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 whitespace-nowrap">
          <AlertTriangle size={13} aria-hidden="true" />
          Critical
        </span>
      );
    case "High":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 whitespace-nowrap">
          <CircleAlert size={13} aria-hidden="true" />
          High
        </span>
      );
    case "Medium":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-400 whitespace-nowrap">
          <Clock size={13} aria-hidden="true" />
          Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 whitespace-nowrap">
          <ArrowUpRight size={13} aria-hidden="true" />
          Low
        </span>
      );
  }
};

export const StatusLabel: React.FC<{ status: ReportStatus | string }> = ({ status }) => {
  switch (status) {
    case "Resolved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-xs font-semibold text-emerald-300 whitespace-nowrap">
          <CheckCircle2 size={12} aria-hidden="true" />
          Resolved
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/50 text-xs font-semibold text-cyan-300 whitespace-nowrap">
          <Wrench size={12} aria-hidden="true" />
          In Progress
        </span>
      );
    case "Assigned":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-700/50 text-xs font-semibold text-blue-300 whitespace-nowrap">
          <ArrowUpRight size={12} aria-hidden="true" />
          Assigned
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/50 text-xs font-semibold text-amber-300 whitespace-nowrap">
          <Clock size={12} aria-hidden="true" />
          Pending
        </span>
      );
  }
};
