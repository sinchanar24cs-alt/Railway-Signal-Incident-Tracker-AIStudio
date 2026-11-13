import React from "react";
import type { DFAResult } from "../types";

interface DFADiagramProps {
  trace: DFAResult | null;
  type: "station" | "incident";
}

export const DFADiagram: React.FC<DFADiagramProps> = ({ trace, type }) => {
  const visitedStates = new Set<string>(["q0"]);
  let finalState = "q0";
  let hitDead = false;

  if (trace) {
    trace.steps.forEach((s) => {
      visitedStates.add(s.from_state);
      visitedStates.add(s.to_state);
      if (s.to_state === "q_dead") hitDead = true;
    });
    finalState = trace.final_state;
  }

  const nodeColor = (state: string, isAccept = false) => {
    if (trace && finalState === state) {
      return isAccept ? "#15803d" : state === "q_dead" ? "#b91c1c" : "#0369a1";
    }
    if (visitedStates.has(state)) return "#1e3a8a";
    return "#0f172a";
  };

  const strokeColor = (state: string, isAccept = false) => {
    if (trace && finalState === state) {
      return isAccept ? "#4ade80" : state === "q_dead" ? "#f87171" : "#38bdf8";
    }
    if (visitedStates.has(state)) return "#60a5fa";
    return "#475569";
  };

  if (type === "station") {
    const nodes = [
      { id: "q0", x: 55, y: 78, label: "q0" },
      { id: "q1", x: 165, y: 78, label: "q1" },
      { id: "q2", x: 275, y: 78, label: "q2" },
      { id: "q3", x: 385, y: 78, label: "q3" },
      { id: "q4", x: 495, y: 78, label: "q4" },
      { id: "q5", x: 610, y: 78, label: "q5", accept: true },
    ];
    const edges = ["A-Z", "A-Z", "A-Z", "0-9", "0-9"];

    return (
      <div className="overflow-x-auto bg-[#080d18] border border-slate-800 rounded-lg p-3">
        <svg viewBox="0 0 680 185" className="w-full max-w-[680px] h-auto">
          <defs>
            <marker id="arrowS" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
            </marker>
          </defs>
          <text x="12" y="20" fill="#94a3b8" fontSize="11" fontWeight="600">
            Station Code DFA: [A-Z]&#123;3&#125;[0-9]&#123;2&#125;
          </text>
          <line x1="12" y1="78" x2="29" y2="78" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrowS)" />

          {nodes.slice(0, 5).map((n, idx) => (
            <g key={n.id}>
              <line
                x1={n.x + 24}
                y1={n.y}
                x2={nodes[idx + 1].x - 26}
                y2={nodes[idx + 1].y}
                stroke="#64748b"
                strokeWidth="2"
                markerEnd="url(#arrowS)"
              />
              <text x={(n.x + nodes[idx + 1].x) / 2} y={n.y - 10} fill="#67e8f9" fontSize="11" textAnchor="middle">
                {edges[idx]}
              </text>
            </g>
          ))}

          {nodes.map((n) => (
            <g key={n.id}>
              {n.accept && (
                <circle cx={n.x} cy={n.y} r="27" fill="none" stroke={strokeColor(n.id, true)} strokeWidth="2" />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r="22"
                fill={nodeColor(n.id, !!n.accept)}
                stroke={strokeColor(n.id, !!n.accept)}
                strokeWidth="2.5"
              />
              <text x={n.x} y={n.y + 4} fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">
                {n.label}
              </text>
            </g>
          ))}

          <rect
            x="275"
            y="135"
            width="110"
            height="34"
            rx="6"
            fill={hitDead ? "#7f1d1d" : "#1e293b"}
            stroke={hitDead ? "#ef4444" : "#475569"}
            strokeWidth="2"
          />
          <text x="330" y="156" fill="#fecaca" fontSize="11" fontWeight="700" textAnchor="middle">
            q_dead (Trap)
          </text>
          <text x="330" y="128" fill="#94a3b8" fontSize="10" textAnchor="middle">
            Invalid transition or length &gt; 5 transitions to q_dead
          </text>
        </svg>
      </div>
    );
  }

  const iNodes = [
    { id: "q0", x: 55, y: 110, label: "q0" },
    { id: "qS1", x: 155, y: 50, label: "qS1" },
    { id: "qS2", x: 255, y: 50, label: "qS2" },
    { id: "qT1", x: 155, y: 110, label: "qT1" },
    { id: "qT2", x: 255, y: 110, label: "qT2" },
    { id: "qE1", x: 155, y: 170, label: "qE1" },
    { id: "qE2", x: 255, y: 170, label: "qE2" },
    { id: "qP", x: 370, y: 110, label: "qP" },
    { id: "qD1", x: 475, y: 110, label: "qD1" },
    { id: "qAccept", x: 590, y: 110, label: "qAcc", accept: true },
  ];

  const iEdges = [
    { from: "q0", to: "qS1", lbl: "S" },
    { from: "qS1", to: "qS2", lbl: "I" },
    { from: "qS2", to: "qP", lbl: "G" },
    { from: "q0", to: "qT1", lbl: "T" },
    { from: "qT1", to: "qT2", lbl: "R" },
    { from: "qT2", to: "qP", lbl: "K" },
    { from: "q0", to: "qE1", lbl: "E" },
    { from: "qE1", to: "qE2", lbl: "L" },
    { from: "qE2", to: "qP", lbl: "E" },
    { from: "qP", to: "qD1", lbl: "0-9" },
    { from: "qD1", to: "qAccept", lbl: "0-9" },
  ];

  const getNode = (id: string) => iNodes.find((n) => n.id === id)!;

  return (
    <div className="overflow-x-auto bg-[#080d18] border border-slate-800 rounded-lg p-3">
      <svg viewBox="0 0 660 230" className="w-full max-w-[660px] h-auto">
        <defs>
          <marker id="arrowI" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
          </marker>
        </defs>
        <text x="12" y="18" fill="#94a3b8" fontSize="11" fontWeight="600">
          Incident Code DFA: (SIG | TRK | ELE)[0-9]&#123;2&#125;
        </text>
        <line x1="12" y1="110" x2="29" y2="110" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrowI)" />

        {iEdges.map((e, idx) => {
          const a = getNode(e.from);
          const b = getNode(e.to);
          return (
            <g key={idx}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#475569" strokeWidth="1.8" />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 6}
                fill="#67e8f9"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
              >
                {e.lbl}
              </text>
            </g>
          );
        })}

        {iNodes.map((n) => (
          <g key={n.id}>
            {n.accept && (
              <circle cx={n.x} cy={n.y} r="25" fill="none" stroke={strokeColor(n.id, true)} strokeWidth="2" />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r="20"
              fill={nodeColor(n.id, !!n.accept)}
              stroke={strokeColor(n.id, !!n.accept)}
              strokeWidth="2.5"
            />
            <text x={n.x} y={n.y + 4} fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}

        <rect
          x="430"
          y="175"
          width="135"
          height="32"
          rx="6"
          fill={hitDead ? "#7f1d1d" : "#1e293b"}
          stroke={hitDead ? "#ef4444" : "#475569"}
          strokeWidth="2"
        />
        <text x="497" y="195" fill="#fecaca" fontSize="11" fontWeight="700" textAnchor="middle">
          q_dead (Trap)
        </text>
      </svg>
    </div>
  );
};
