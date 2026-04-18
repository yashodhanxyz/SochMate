"use client";

/**
 * GambitPractice — interactive board for practicing a gambit line.
 *
 * The component replays opponent moves automatically and waits for the
 * student to play the correct move. Feedback is shown inline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";
import type { GambitData } from "@/lib/gambits";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

// Delay (ms) before the computer auto-plays an opponent move
const OPPONENT_DELAY_MS = 600;

type Phase =
  | "playing"      // waiting for student's move
  | "opponent"     // computer is about to play
  | "wrong"        // student played a wrong move
  | "complete";    // all moves played

interface Props {
  gambit: GambitData;
  onClose: () => void;
}

export default function GambitPractice({ gambit, onClose }: Props) {
  const { moves_uci, player_color } = gambit;

  // chess.js instance — kept in a ref so it survives re-renders
  const chessRef = useRef(new Chess());

  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [moveIndex, setMoveIndex] = useState(0);  // next move to play in moves_uci
  const [phase, setPhase] = useState<Phase>("playing");
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // The index in moves_uci that belongs to the student:
  // white → even indices (0, 2, 4 …); black → odd indices (1, 3, 5 …)
  const isStudentTurn = useCallback(
    (idx: number) =>
      player_color === "white" ? idx % 2 === 0 : idx % 2 === 1,
    [player_color]
  );

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setMoveIndex(0);
    setPhase("playing");
    setLastWrong(null);
    setShowHint(false);
  }, []);

  // ── auto-play opponent move ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "opponent") return;
    if (moveIndex >= moves_uci.length) {
      setPhase("complete");
      return;
    }

    const timer = setTimeout(() => {
      const uci = moves_uci[moveIndex];
      try {
        chessRef.current.move({
          from: uci.slice(0, 2) as Parameters<Chess["move"]>[0] extends { from: infer F } ? F : string,
          to:   uci.slice(2, 4),
          promotion: uci[4] ?? "q",
        });
      } catch {
        // shouldn't happen if our UCI data is correct
        console.error("Opponent move failed:", uci);
      }
      const nextIdx = moveIndex + 1;
      setFen(chessRef.current.fen());
      setMoveIndex(nextIdx);

      if (nextIdx >= moves_uci.length) {
        setPhase("complete");
      } else {
        setPhase("playing");
        setShowHint(false);
      }
    }, OPPONENT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [phase, moveIndex, moves_uci]);

  // ── initial opponent move (when player is black) ───────────────────────────
  useEffect(() => {
    if (moveIndex === 0 && !isStudentTurn(0)) {
      setPhase("opponent");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── handle student drag/drop ───────────────────────────────────────────────
  function onDrop({
    sourceSquare,
    targetSquare,
    piece,
  }: {
    piece: { pieceType: string; isSparePiece: boolean; position: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (phase !== "playing") return false;
    if (moveIndex >= moves_uci.length) return false;
    if (!targetSquare) return false;

    const expected = moves_uci[moveIndex];
    const pieceType: string = piece?.pieceType ?? "";
    const promotion = pieceType[1]?.toLowerCase() === "p" ? "q" : (expected[4] ?? undefined);
    const attemptUci = sourceSquare + targetSquare + (promotion ?? "");

    // Validate against expected UCI (ignoring promotion char unless present)
    const normalised = (u: string) => u.slice(0, 4);
    if (normalised(attemptUci) !== normalised(expected)) {
      setLastWrong(sourceSquare + targetSquare);
      setPhase("wrong");
      // Bounce back to playing after a short flash
      setTimeout(() => {
        setPhase("playing");
        setLastWrong(null);
      }, 700);
      return false;
    }

    // Legal move on chess.js board
    try {
      chessRef.current.move({
        from: sourceSquare,
        to:   targetSquare,
        promotion: promotion ?? "q",
      });
    } catch {
      return false;
    }

    const nextIdx = moveIndex + 1;
    setFen(chessRef.current.fen());
    setMoveIndex(nextIdx);
    setShowHint(false);
    setLastWrong(null);

    if (nextIdx >= moves_uci.length) {
      setPhase("complete");
    } else {
      // Next move is opponent's
      setPhase("opponent");
    }

    return true;
  }

  // ── hint: highlight the source square of the expected move ────────────────
  const hintSquare = showHint && moveIndex < moves_uci.length
    ? moves_uci[moveIndex].slice(0, 2)
    : null;

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (hintSquare) {
    customSquareStyles[hintSquare] = { background: "rgba(251, 191, 36, 0.55)" };
  }
  if (lastWrong) {
    customSquareStyles[lastWrong.slice(0, 2)] = { background: "rgba(239, 68, 68, 0.45)" };
    customSquareStyles[lastWrong.slice(2, 4)] = { background: "rgba(239, 68, 68, 0.30)" };
  }

  // ── progress text ─────────────────────────────────────────────────────────
  // Count only the student's moves in the sequence
  const studentMoveCount = moves_uci.filter((_, i) => isStudentTurn(i)).length;
  const studentMovePlayed = moves_uci
    .slice(0, moveIndex)
    .filter((_, i) => isStudentTurn(i)).length;

  const statusText = (() => {
    if (phase === "complete") return "✓ Line complete!";
    if (phase === "wrong")    return "✗ That's not the right move — try again";
    if (phase === "opponent") return "Opponent is thinking…";
    return `Move ${studentMovePlayed + 1} of ${studentMoveCount} — your turn`;
  })();

  const statusColor = (() => {
    if (phase === "complete") return "#22c55e";
    if (phase === "wrong")    return "#ef4444";
    if (phase === "opponent") return "var(--text-secondary)";
    return "var(--text-primary)";
  })();

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="font-semibold text-base"
            style={{ color: "var(--text-primary)" }}
          >
            {gambit.name}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            You play{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {player_color}
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Status bar */}
      <div
        style={{
          background: "var(--surface-2)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 500,
          color: statusColor,
          minHeight: 36,
          display: "flex",
          alignItems: "center",
        }}
      >
        {statusText}
      </div>

      {/* Board */}
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop: onDrop,
            boardOrientation: player_color,
            allowDragging: phase === "playing",
            squareStyles: customSquareStyles,
            boardStyle: { borderRadius: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.35)" },
            darkSquareStyle:  { backgroundColor: "#769656" },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
          }}
        />
      </div>

      {/* Key ideas */}
      <div
        style={{
          background: "var(--surface-2)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
        }}
      >
        <p
          className="font-medium mb-1.5 text-xs uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          Key ideas
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {gambit.key_ideas.map((idea, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>▸</span>
              <span style={{ color: "var(--text-secondary)", lineHeight: 1.45 }}>{idea}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {phase === "playing" && !showHint && (
          <button
            onClick={() => setShowHint(true)}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            💡 Hint
          </button>
        )}
        <button
          onClick={reset}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          ↺ Restart
        </button>
        {phase === "complete" && (
          <button
            onClick={reset}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 8,
              padding: "6px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Practice again
          </button>
        )}
      </div>
    </div>
  );
}
