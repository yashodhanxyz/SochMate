"use client";

import type { GameData, GameSummaryData } from "@/types/analysis";

interface Props {
  game: GameData;
  summary: GameSummaryData;
  userColor?: "white" | "black" | null;
}

export default function GameSummary({ game, summary, userColor }: Props) {
  const playerColor = userColor ?? "white";
  const opponentColor = playerColor === "white" ? "black" : "white";

  const playerAccuracy =
    playerColor === "white" ? summary.accuracy_white : summary.accuracy_black;
  const opponentAccuracy =
    opponentColor === "white" ? summary.accuracy_white : summary.accuracy_black;

  const playerName =
    playerColor === "white" ? game.white_player : game.black_player;
  const opponentName =
    opponentColor === "white" ? game.white_player : game.black_player;

  const resultLabel = formatResult(game.result, playerColor);

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {playerName ?? "You"} vs {opponentName ?? "Opponent"}
            </span>
            <ResultBadge result={game.result} playerColor={playerColor} />
          </div>
          <div
            className="text-xs flex items-center gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {game.opening_name && <span>{game.opening_name}</span>}
            {game.opening_name && game.time_control && <span>·</span>}
            {game.time_control && <span>{formatTimeControl(game.time_control)}</span>}
            {game.played_at && (
              <>
                <span>·</span>
                <span>{formatDate(game.played_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Accuracy row */}
      <div className="grid grid-cols-2 gap-3">
        <AccuracyCard
          label="Your accuracy"
          accuracy={playerAccuracy}
          color={playerColor}
          highlight
        />
        <AccuracyCard
          label="Opponent accuracy"
          accuracy={opponentAccuracy}
          color={opponentColor}
        />
      </div>

      {/* Mistake breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Blunders"
          you={playerColor === "white" ? summary.blunders_white : summary.blunders_black}
          them={opponentColor === "white" ? summary.blunders_white : summary.blunders_black}
          color="var(--color-blunder)"
        />
        <StatCard
          label="Mistakes"
          you={playerColor === "white" ? summary.mistakes_white : summary.mistakes_black}
          them={opponentColor === "white" ? summary.mistakes_white : summary.mistakes_black}
          color="var(--color-mistake)"
        />
        <StatCard
          label="Inaccuracies"
          you={playerColor === "white" ? summary.inaccuracies_white : summary.inaccuracies_black}
          them={opponentColor === "white" ? summary.inaccuracies_white : summary.inaccuracies_black}
          color="var(--color-inaccuracy)"
        />
      </div>

      {/* Summary text */}
      {summary.summary_text && (
        <p
          className="text-sm leading-relaxed"
          style={{
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
            paddingTop: "16px",
          }}
        >
          {summary.summary_text}
        </p>
      )}
    </div>
  );
}

// Sub-components

function AccuracyCard({
  label,
  accuracy,
  color,
  highlight,
}: {
  label: string;
  accuracy: number | null;
  color: "white" | "black";
  highlight?: boolean;
}) {
  const pct = accuracy ?? 0;
  const accentColor = pct >= 85 ? "#22c55e" : pct >= 65 ? "#fbbf24" : "#ef4444";

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{
        background: highlight ? "rgba(91,141,238,0.06)" : "var(--surface-2)",
        border: `1px solid ${highlight ? "rgba(91,141,238,0.25)" : "var(--border)"}`,
      }}
    >
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: accentColor }}
        >
          {pct.toFixed(0)}
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          %
        </span>
      </div>
      {/* Mini accuracy bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ height: "4px", background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: accentColor }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  you,
  them,
  color,
}: {
  label: string;
  you: number;
  them: number;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold" style={{ color }}>
          {you}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          vs {them}
        </span>
      </div>
    </div>
  );
}

function ResultBadge({
  result,
  playerColor,
}: {
  result: string | null;
  playerColor: "white" | "black";
}) {
  if (!result || result === "*") return null;

  let label = "Draw";
  let bg = "rgba(251,191,36,0.15)";
  let color = "#fbbf24";

  if (
    (result === "1-0" && playerColor === "white") ||
    (result === "0-1" && playerColor === "black")
  ) {
    label = "Win";
    bg = "rgba(34,197,94,0.15)";
    color = "#22c55e";
  } else if (
    (result === "1-0" && playerColor === "black") ||
    (result === "0-1" && playerColor === "white")
  ) {
    label = "Loss";
    bg = "rgba(239,68,68,0.15)";
    color = "#ef4444";
  }

  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function formatTimeControl(tc: string): string {
  // "600" → "10 min", "180+2" → "3+2", "60+0" → "1 min"
  if (!tc || tc === "-") return "";
  const [base, inc] = tc.split("+");
  const mins = Math.floor(parseInt(base) / 60);
  if (isNaN(mins)) return tc;
  if (inc && parseInt(inc) > 0) return `${mins}+${inc}`;
  return `${mins} min`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatResult(result: string | null, playerColor: "white" | "black") {
  if (!result || result === "*") return "";
  if (result === "1/2-1/2") return "½–½";
  return result;
}
