"use client";

import type { MoveData } from "@/types/analysis";
import { getConfig } from "@/lib/classification";

interface Props {
  move: MoveData | null;
}

export default function MoveFeedback({ move }: Props) {
  if (!move) {
    return (
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        Click a move to see feedback.
      </div>
    );
  }

  const cfg = getConfig(move.classification);

  return (
    <div
      className="rounded-xl px-4 py-4 flex flex-col gap-3"
      style={{
        background: cfg ? cfg.bg : "var(--surface)",
        border: `1px solid ${cfg ? cfg.color + "40" : "var(--border)"}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-bold text-base"
            style={{ color: "var(--text-primary)" }}
          >
            {move.move_number}. {move.color === "black" ? "…" : ""}{move.san}
          </span>
          {cfg && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.color}50`,
              }}
            >
              {cfg.symbol} {cfg.label}
            </span>
          )}
        </div>

        {/* Eval delta */}
        {move.eval_delta_cp !== null && move.eval_delta_cp > 0 && (
          <span
            className="text-xs font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            −{(move.eval_delta_cp / 100).toFixed(1)} pawns
          </span>
        )}
      </div>

      {/* Explanation */}
      {move.explanation && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {move.explanation}
        </p>
      )}

      {/* Best move */}
      {move.best_move_san && move.best_move_san !== move.san && (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Best move:</span>
          <span
            className="font-mono font-semibold px-2 py-0.5 rounded"
            style={{
              background: "rgba(91,141,238,0.12)",
              color: "var(--accent)",
            }}
          >
            {move.best_move_san}
          </span>
        </div>
      )}
    </div>
  );
}
