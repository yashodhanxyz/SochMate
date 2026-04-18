"use client";

import { useEffect, useRef } from "react";
import type { MoveData } from "@/types/analysis";
import { getConfig } from "@/lib/classification";

interface Props {
  moves: MoveData[];
  currentPly: number;
  onPlyChange: (ply: number) => void;
}

export default function MoveList({ moves, currentPly, onPlyChange }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active move into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPly]);

  // Group plies into move pairs: [[white_ply, black_ply?], ...]
  const pairs: [MoveData, MoveData | null][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1] ?? null]);
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-y-auto" style={{ maxHeight: "360px" }}>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {pairs.map(([white, black]) => (
              <tr
                key={white.ply_number}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                {/* Move number */}
                <td
                  className="pl-4 pr-2 py-1.5 text-xs tabular-nums select-none w-8"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {white.move_number}.
                </td>

                {/* White move */}
                <td className="py-1 pr-1 w-1/2">
                  <MoveCell
                    move={white}
                    isActive={currentPly === white.ply_number}
                    onClick={() => onPlyChange(white.ply_number)}
                    ref={currentPly === white.ply_number ? activeRef : null}
                  />
                </td>

                {/* Black move */}
                <td className="py-1 pl-1 pr-4 w-1/2">
                  {black ? (
                    <MoveCell
                      move={black}
                      isActive={currentPly === black.ply_number}
                      onClick={() => onPlyChange(black.ply_number)}
                      ref={currentPly === black.ply_number ? activeRef : null}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface MoveCellProps {
  move: MoveData;
  isActive: boolean;
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement> | null;
}

const PATTERN_ICONS: Record<string, string> = {
  fork: "⑂",
  hanging: "⊗",
  pin: "📌",
  skewer: "⟹",
  discovered_attack: "◈",
  back_rank: "♜",
};

function MoveCell({ move, isActive, onClick, ref }: MoveCellProps) {
  const cfg = getConfig(move.classification);
  const patternIcon = move.pattern_tag ? PATTERN_ICONS[move.pattern_tag] : null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="w-full text-left px-2 py-1 rounded flex items-center gap-1.5 transition-colors font-mono"
      style={{
        background: isActive ? "var(--accent)" : "transparent",
        color: isActive ? "#fff" : "var(--text-primary)",
        cursor: "pointer",
      }}
      title={move.pattern_tag ? `Missed tactic: ${move.pattern_tag.replace("_", " ")}` : move.explanation ?? undefined}
    >
      {/* SAN */}
      <span className="font-medium">{move.san}</span>

      {/* Classification badge */}
      {cfg && (
        <span
          className="text-xs font-semibold"
          style={{ color: isActive ? "rgba(255,255,255,0.85)" : cfg.color }}
          title={cfg.label}
        >
          {cfg.symbol}
        </span>
      )}

      {/* Pattern icon */}
      {patternIcon && !isActive && (
        <span className="text-xs ml-auto opacity-70" title={move.pattern_tag?.replace("_", " ")}>
          {patternIcon}
        </span>
      )}
    </button>
  );
}
