"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { MoveData } from "@/types/analysis";
import EvalBar from "./EvalBar";

type Arrow = { startSquare: string; endSquare: string; color: string };

// react-chessboard uses browser APIs — must be dynamically imported with ssr:false
const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface Props {
  moves: MoveData[];
  currentPly: number;        // 0 = start, N = after ply N
  onPlyChange: (ply: number) => void;
  userColor?: "white" | "black" | null;
}

export default function AnalysisBoard({
  moves,
  currentPly,
  onPlyChange,
  userColor,
}: Props) {
  // FEN for the current ply
  const currentFen =
    currentPly === 0
      ? STARTING_FEN
      : moves[currentPly - 1]?.fen_after ?? STARTING_FEN;

  const currentMove = currentPly > 0 ? moves[currentPly - 1] : null;

  // Arrow: show best move for blunders/mistakes when a different move was played
  const arrows: Arrow[] = [];
  if (
    currentMove &&
    currentMove.best_move_uci &&
    currentMove.best_move_uci !== currentMove.uci &&
    (currentMove.classification === "blunder" ||
      currentMove.classification === "mistake")
  ) {
    const uci = currentMove.best_move_uci;
    arrows.push({
      startSquare: uci.slice(0, 2),
      endSquare: uci.slice(2, 4),
      color: "rgba(91, 141, 238, 0.8)",
    });
  }

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

  // Board orientation
  const boardOrientation =
    userColor === "black" ? "black" : "white";

  return (
    <div className="flex flex-col gap-3">
      {/* Board + eval bar */}
      <div className="flex items-start gap-2">
        <EvalBar
          evalCp={currentMove?.eval_after_cp ?? null}
          evalMate={currentMove?.eval_after_mate ?? null}
        />
        <div className="flex-1">
          <Chessboard
            options={{
              position: currentFen,
              boardOrientation,
              allowDragging: false,
              arrows,
              boardStyle: {
                borderRadius: "8px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              },
              darkSquareStyle: { backgroundColor: "#4a7c59" },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
            }}
          />
        </div>
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

        <span
          className="text-xs tabular-nums"
          style={{ color: "var(--text-secondary)" }}
        >
          {currentPly === 0
            ? "Start"
            : `Move ${currentMove?.move_number} (${currentMove?.color})`}
        </span>
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
