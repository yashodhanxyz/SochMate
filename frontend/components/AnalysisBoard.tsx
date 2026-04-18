"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { MoveData, MoveClassification } from "@/types/analysis";
import EvalBar from "./EvalBar";

// react-chessboard uses browser APIs — must be dynamically imported with ssr:false
const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Arrow colours keyed by classification severity
const PLAYED_ARROW_COLOR: Record<string, string> = {
  blunder:    "rgba(239, 68,  68,  0.85)", // red
  mistake:    "rgba(249, 115, 22,  0.85)", // orange
  inaccuracy: "rgba(251, 191, 36,  0.80)", // amber
};
const BEST_ARROW_COLOR = "rgba(34, 197, 94, 0.85)";   // green

interface Arrow { startSquare: string; endSquare: string; color: string }

function uciToArrow(uci: string, color: string): Arrow {
  return { startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color };
}

function buildArrows(move: MoveData | null): Arrow[] {
  if (!move) return [];

  const cls = move.classification as MoveClassification | null;
  const playedColor = cls ? PLAYED_ARROW_COLOR[cls] : undefined;
  const hasBest = move.best_move_uci && move.best_move_uci !== move.uci;

  if (!playedColor) return [];           // best / excellent / good — no arrows

  const arrows: Arrow[] = [];

  // Played move — severity colour
  arrows.push(uciToArrow(move.uci, playedColor));

  // Best move — green (only when different from played)
  if (hasBest) {
    arrows.push(uciToArrow(move.best_move_uci!, BEST_ARROW_COLOR));
  }

  return arrows;
}

interface Props {
  moves: MoveData[];
  currentPly: number;        // 0 = start, N = after ply N
  onPlyChange: (ply: number) => void;
  userColor?: "white" | "black" | null;
  boardFlipped?: boolean;
  onFlip?: () => void;
}

export default function AnalysisBoard({
  moves,
  currentPly,
  onPlyChange,
  userColor,
  boardFlipped,
}: Props) {
  // FEN for the current ply
  const currentFen =
    currentPly === 0
      ? STARTING_FEN
      : moves[currentPly - 1]?.fen_after ?? STARTING_FEN;

  const currentMove = currentPly > 0 ? moves[currentPly - 1] : null;

  // Eval of the current position (after the move was played)
  const evalCp   = currentMove?.eval_after_cp   ?? null;
  const evalMate = currentMove?.eval_after_mate ?? null;

  const arrows = buildArrows(currentMove);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")
        onPlyChange(Math.max(0, currentPly - 1));
      if (e.key === "ArrowRight")
        onPlyChange(Math.min(moves.length, currentPly + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentPly, moves.length, onPlyChange]);

  // Board orientation: start from user's color, then toggle if flipped
  const baseOrientation: "white" | "black" = userColor === "black" ? "black" : "white";
  const boardOrientation: "white" | "black" = boardFlipped
    ? (baseOrientation === "white" ? "black" : "white")
    : baseOrientation;

  return (
    <div className="flex flex-col gap-3">
      {/* Board row — eval bar absolutely overlaid to left of board */}
      <div className="relative" style={{ paddingLeft: "26px" }}>
        {/* Eval bar: absolute, stretches to exact board height */}
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: "20px" }}
        >
          <EvalBar evalCp={evalCp} evalMate={evalMate} />
        </div>

        {/* Board */}
        <Chessboard
          options={{
            position: currentFen,
            boardOrientation,
            allowDragging: false,
            arrows,
            clearArrowsOnClick: false,
            clearArrowsOnPositionChange: false,
            showNotation: true,
            boardStyle: {
              borderRadius: "8px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            },
            darkSquareStyle:  { backgroundColor: "#4a7c59" },
            lightSquareStyle: { backgroundColor: "#f0d9b5" },
            darkSquareNotationStyle:  { color: "#f0d9b5", fontSize: "10px" },
            lightSquareNotationStyle: { color: "#4a7c59", fontSize: "10px" },
          }}
        />
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <NavButton
            label="⏮"
            title="Start"
            onClick={() => onPlyChange(0)}
            disabled={currentPly === 0}
          />
          <NavButton
            label="◀"
            title="Previous move (←)"
            onClick={() => onPlyChange(Math.max(0, currentPly - 1))}
            disabled={currentPly === 0}
          />
          <NavButton
            label="▶"
            title="Next move (→)"
            onClick={() => onPlyChange(Math.min(moves.length, currentPly + 1))}
            disabled={currentPly === moves.length}
          />
          <NavButton
            label="⏭"
            title="End"
            onClick={() => onPlyChange(moves.length)}
            disabled={currentPly === moves.length}
          />
        </div>

        {/* Arrow legend — only shown when arrows are active */}
        {arrows.length > 0 ? (
          <div className="flex items-center gap-2">
            <LegendDot color={PLAYED_ARROW_COLOR[currentMove?.classification ?? ""] ?? ""} label="Played" />
            {arrows.length > 1 && (
              <LegendDot color={BEST_ARROW_COLOR} label="Best" />
            )}
          </div>
        ) : (
          <span
            className="text-xs tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {currentPly === 0
              ? "Start"
              : `Move ${currentMove?.move_number} (${currentMove?.color})`}
          </span>
        )}
      </div>
    </div>
  );
}

function NavButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded flex items-center justify-center text-sm transition-colors"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: disabled ? "var(--border)" : "var(--text-secondary)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block rounded-full"
        style={{ width: "8px", height: "8px", background: color }}
      />
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}
