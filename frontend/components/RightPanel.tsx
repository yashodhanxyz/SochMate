"use client";

import { useState } from "react";
import type { GameData, MoveData } from "@/types/analysis";
import MoveList from "./MoveList";
import MoveFeedback from "./MoveFeedback";
import GameSummary from "./GameSummary";

type Tab = "moves" | "summary";

interface Props {
  game: GameData;
  currentPly: number;
  onPlyChange: (ply: number) => void;
}

// ---------------------------------------------------------------------------
// Pattern config
// ---------------------------------------------------------------------------

const PATTERN_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  fork:             { label: "Fork",              icon: "⑂", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  hanging:          { label: "Hanging piece",     icon: "⊗", color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  pin:              { label: "Pin",               icon: "📌", color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  skewer:           { label: "Skewer",            icon: "⟹", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  discovered_attack:{ label: "Discovered attack", icon: "◈", color: "#06b6d4", bg: "rgba(6,182,212,0.12)"  },
  back_rank:        { label: "Back-rank",         icon: "♜", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

// ---------------------------------------------------------------------------
// Result banner helpers
// ---------------------------------------------------------------------------

function getResultBanner(
  result: string | null,
  userColor: "white" | "black" | null
): { text: string; bg: string; color: string } | null {
  if (!result || result === "*") return null;

  const uc = userColor ?? "white";
  const won  = (result === "1-0" && uc === "white") || (result === "0-1" && uc === "black");
  const lost = (result === "1-0" && uc === "black") || (result === "0-1" && uc === "white");
  const draw = result === "1/2-1/2";

  if (won)  return { text: "You Won!",  bg: "rgba(34,197,94,0.14)",  color: "#22c55e" };
  if (lost) return { text: "You Lost",  bg: "rgba(239,68,68,0.12)",  color: "#ef4444" };
  if (draw) return { text: "Draw",      bg: "rgba(251,191,36,0.12)", color: "#fbbf24" };
  return null;
}

// ---------------------------------------------------------------------------
// Missed tactics component
// ---------------------------------------------------------------------------

function MissedTactics({
  moves,
  userColor,
  onPlyChange,
}: {
  moves: MoveData[];
  userColor: "white" | "black" | null;
  onPlyChange: (ply: number) => void;
}) {
  // Only show missed tactics for the user's own moves
  const uc = userColor ?? null;
  const tactical = moves.filter(
    (m) =>
      m.pattern_tag !== null &&
      (uc === null || m.color === uc)
  );

  if (tactical.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        Missed Tactics ({tactical.length})
      </h3>

      {tactical.map((m) => {
        const cfg = PATTERN_CONFIG[m.pattern_tag!];
        if (!cfg) return null;
        return (
          <button
            key={m.ply_number}
            type="button"
            onClick={() => onPlyChange(m.ply_number)}
            className="flex items-center gap-3 w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, cursor: "pointer" }}
          >
            {/* Icon */}
            <span className="text-lg flex-shrink-0" style={{ color: cfg.color }}>
              {cfg.icon}
            </span>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                {cfg.label}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Move {m.move_number}
                {m.color === "black" ? "…" : ". "}
                {m.san}
                {m.best_move_san && m.best_move_san !== m.san && (
                  <span style={{ color: "var(--accent)" }}> → best was {m.best_move_san}</span>
                )}
              </p>
            </div>

            {/* Jump arrow */}
            <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
              →
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RightPanel({ game, currentPly, onPlyChange }: Props) {
  const [tab, setTab] = useState<Tab>("moves");
  const currentMove = currentPly > 0 ? game.moves[currentPly - 1] : null;
  const banner = getResultBanner(game.result, game.user_color);

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Result banner */}
      {banner && (
        <div
          className="px-4 py-2.5 text-center font-bold text-base tracking-wide"
          style={{ background: banner.bg, color: banner.color }}
        >
          {banner.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["moves", "summary"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "moves" ? (
        <div className="flex flex-col">
          <MoveList
            moves={game.moves}
            currentPly={currentPly}
            onPlyChange={onPlyChange}
          />
          <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
            <MoveFeedback move={currentMove} />
          </div>
        </div>
      ) : (
        <div className="overflow-y-auto p-4 flex flex-col gap-6" style={{ maxHeight: "600px" }}>
          {/* Missed tactics — shown first */}
          <MissedTactics
            moves={game.moves}
            userColor={game.user_color}
            onPlyChange={(ply) => {
              onPlyChange(ply);
              setTab("moves"); // switch to moves tab so board updates
            }}
          />

          {/* Accuracy / summary */}
          {game.summary ? (
            <GameSummary
              game={game}
              summary={game.summary}
              userColor={game.user_color}
            />
          ) : (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-secondary)" }}>
              No summary available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
