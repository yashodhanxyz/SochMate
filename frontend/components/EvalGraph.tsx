"use client";

import { useState } from "react";
import type { MoveData } from "@/types/analysis";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const VB_W = 600;
const VB_H = 80;
const MID_Y = VB_H / 2;
const CLAMP_CP = 800; // ±8 pawns — tighter clamp makes swings more visible

const DOT_COLOR: Record<string, string> = {
  blunder:    "#ef4444",
  mistake:    "#f97316",
  inaccuracy: "#fbbf24",
};

function evalToY(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 3 : VB_H - 3;
  if (cp === null) return MID_Y;
  const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, cp));
  // Positive cp (white ahead) → above center → smaller Y
  return MID_Y - (clamped / CLAMP_CP) * MID_Y * 0.92;
}

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  if (cp === null) return "0.0";
  if (cp === 0) return "0.0";
  return `${cp > 0 ? "+" : "−"}${(Math.abs(cp) / 100).toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  moves: MoveData[];
  currentPly: number;   // 0 = start, N = after move N
  onPlyChange: (ply: number) => void;
}

export default function EvalGraph({ moves, currentPly, onPlyChange }: Props) {
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  if (moves.length === 0) return null;

  // Build N+1 eval points (index 0 = start position, eval = 0)
  const pts = [
    { x: 0, y: MID_Y, cp: null as number | null, mate: null as number | null },
    ...moves.map((m, i) => ({
      x: ((i + 1) / moves.length) * VB_W,
      y: evalToY(m.eval_after_cp, m.eval_after_mate),
      cp: m.eval_after_cp,
      mate: m.eval_after_mate,
    })),
  ];

  // White area: from center, up to eval line (capped so it never goes below center)
  const whiteArea =
    `M 0,${MID_Y} ` +
    pts.map((p) => `L ${p.x},${Math.min(p.y, MID_Y)}`).join(" ") +
    ` L ${VB_W},${MID_Y} Z`;

  // Black area: from center, down to eval line (capped so it never goes above center)
  const blackArea =
    `M 0,${MID_Y} ` +
    pts.map((p) => `L ${p.x},${Math.max(p.y, MID_Y)}`).join(" ") +
    ` L ${VB_W},${MID_Y} Z`;

  // Eval polyline
  const evalLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");

  // Current ply x position
  const currentX = (currentPly / moves.length) * VB_W;

  // Hover ply
  const hovX = hoverPly !== null ? (hoverPly / moves.length) * VB_W : null;
  const hovPt = hoverPly !== null ? pts[hoverPly] : null;

  // Mouse interaction helpers
  function plyFromMouseX(e: React.MouseEvent<SVGSVGElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(moves.length, Math.round(rel * moves.length)));
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-3 pt-2 pb-1"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Evaluation
        </span>
        {hovPt && (
          <span
            className="text-xs font-mono tabular-nums"
            style={{
              color:
                (hovPt.cp ?? 0) > 0
                  ? "#f0d9b5"
                  : (hovPt.cp ?? 0) < 0
                  ? "#888"
                  : "var(--text-secondary)",
            }}
          >
            {formatEval(hovPt.cp, hovPt.mate)}
          </span>
        )}
      </div>

      {/* SVG graph */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "80px", cursor: "pointer" }}
        onMouseMove={(e) => setHoverPly(plyFromMouseX(e))}
        onMouseLeave={() => setHoverPly(null)}
        onClick={(e) => onPlyChange(plyFromMouseX(e))}
      >
        {/* White (cream) advantage fill */}
        <path d={whiteArea} fill="#e8d9b5" opacity="0.9" />

        {/* Black (dark) advantage fill */}
        <path d={blackArea} fill="#2a2a2a" opacity="0.95" />

        {/* Subtle ±2 pawn gridlines */}
        {[200, -200].map((cp) => {
          const gy = evalToY(cp, null);
          return (
            <line
              key={cp}
              x1={0} y1={gy} x2={VB_W} y2={gy}
              stroke="rgba(128,128,128,0.2)"
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Center line */}
        <line
          x1={0} y1={MID_Y} x2={VB_W} y2={MID_Y}
          stroke="rgba(128,128,128,0.4)"
          strokeWidth="0.75"
        />

        {/* Eval line */}
        <path
          d={evalLine}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Classification dots — blunders, mistakes, inaccuracies */}
        {moves.map((m, i) => {
          const color = m.classification ? DOT_COLOR[m.classification] : undefined;
          if (!color) return null;
          const pt = pts[i + 1];
          return (
            <circle
              key={m.ply_number}
              cx={pt.x}
              cy={pt.y}
              r={m.classification === "blunder" ? 2.8 : m.classification === "mistake" ? 2.2 : 1.6}
              fill={color}
              opacity="0.9"
            />
          );
        })}

        {/* Hover vertical line */}
        {hovX !== null && (
          <line
            x1={hovX} y1={0} x2={hovX} y2={VB_H}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
          />
        )}

        {/* Hover dot on eval line */}
        {hovX !== null && hovPt && (
          <circle
            cx={hovX}
            cy={hovPt.y}
            r="3"
            fill="white"
            opacity="0.85"
          />
        )}

        {/* Current ply vertical line */}
        <line
          x1={currentX} y1={0} x2={currentX} y2={VB_H}
          stroke="var(--accent)"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* Current ply dot */}
        {currentPly > 0 && (
          <circle
            cx={currentX}
            cy={pts[currentPly]?.y ?? MID_Y}
            r="3.5"
            fill="var(--accent)"
            opacity="0.95"
          />
        )}
      </svg>

      {/* Bottom: legend */}
      <div
        className="flex items-center gap-4 px-3 pb-2 pt-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <LegendItem color="#f0d9b5" label="White better" />
        <LegendItem color="#555" label="Black better" />
        <div className="ml-auto flex items-center gap-3">
          <LegendDot color="#ef4444" label="Blunder" />
          <LegendDot color="#f97316" label="Mistake" />
          <LegendDot color="#fbbf24" label="Inaccuracy" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block rounded-sm"
        style={{ width: "12px", height: "8px", background: color, border: "1px solid rgba(255,255,255,0.1)" }}
      />
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block rounded-full"
        style={{ width: "7px", height: "7px", background: color }}
      />
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}
