"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyGames, getGame } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import type { GameData, GameStatusData } from "@/types/analysis";

type GamePreview = {
  status: GameStatusData;
  detail: GameData | null;
};

export default function GamesClient() {
  const [games, setGames] = useState<GamePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = getSessionToken();
        const statuses = await listMyGames(token);

        // Fetch full details for done games (for player names + accuracy)
        const previews = await Promise.all(
          statuses.map(async (s): Promise<GamePreview> => {
            if (s.status === "done") {
              try {
                const detail = await getGame(s.game_id);
                return { status: s, detail };
              } catch {
                return { status: s, detail: null };
              }
            }
            return { status: s, detail: null };
          })
        );

        setGames(previews);
      } catch {
        setError("Could not load your games. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center" style={{ color: "var(--text-secondary)" }}>
        Loading your games…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center" style={{ color: "var(--color-blunder)" }}>
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          My Games
        </h1>
        <Link
          href="/"
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          + Analyze New Game
        </Link>
      </div>

      {games.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-base mb-4" style={{ color: "var(--text-secondary)" }}>
            No games analyzed yet.
          </p>
          <Link
            href="/"
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Analyze your first game →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {games.map(({ status, detail }) => (
            <GameCard key={status.game_id} status={status} detail={detail} />
          ))}
        </div>
      )}
    </div>
  );
}

function GameCard({
  status,
  detail,
}: {
  status: GameStatusData;
  detail: GameData | null;
}) {
  const isPending = status.status !== "done" && status.status !== "failed";
  const isFailed = status.status === "failed";

  const userColor = detail?.user_color ?? "white";
  const playerName =
    userColor === "white" ? detail?.white_player : detail?.black_player;
  const opponentName =
    userColor === "white" ? detail?.black_player : detail?.white_player;

  const accuracy =
    detail?.summary
      ? userColor === "white"
        ? detail.summary.accuracy_white
        : detail.summary.accuracy_black
      : null;

  const blunders =
    detail?.summary
      ? userColor === "white"
        ? detail.summary.blunders_white
        : detail.summary.blunders_black
      : null;

  const mistakes =
    detail?.summary
      ? userColor === "white"
        ? detail.summary.mistakes_white
        : detail.summary.mistakes_black
      : null;

  return (
    <Link
      href={`/analyze/${status.game_id}`}
      className="block rounded-xl p-4 transition-colors"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: isFailed ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: players + opening */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {playerName ?? "You"} vs {opponentName ?? "Opponent"}
            </span>
            {detail?.result && detail.result !== "*" && (
              <ResultChip result={detail.result} userColor={userColor} />
            )}
          </div>
          {detail?.opening_name && (
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {detail.opening_name}
            </span>
          )}
          {isFailed && (
            <span className="text-xs" style={{ color: "var(--color-blunder)" }}>
              Analysis failed
            </span>
          )}
          {isPending && (
            <span className="text-xs" style={{ color: "var(--color-inaccuracy)" }}>
              Analysis in progress…
            </span>
          )}
        </div>

        {/* Right: accuracy + mistake counts */}
        {accuracy !== null && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="text-lg font-bold tabular-nums"
              style={{
                color:
                  accuracy >= 85
                    ? "#22c55e"
                    : accuracy >= 65
                    ? "#fbbf24"
                    : "#ef4444",
              }}
            >
              {accuracy?.toFixed(0)}%
            </span>
            {(blunders !== null || mistakes !== null) && (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {blunders} blunder{blunders !== 1 ? "s" : ""} · {mistakes} mistake
                {mistakes !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function ResultChip({
  result,
  userColor,
}: {
  result: string;
  userColor: "white" | "black";
}) {
  let label = "Draw";
  let color = "#fbbf24";

  if (
    (result === "1-0" && userColor === "white") ||
    (result === "0-1" && userColor === "black")
  ) {
    label = "Win";
    color = "#22c55e";
  } else if (
    (result === "1-0" && userColor === "black") ||
    (result === "0-1" && userColor === "white")
  ) {
    label = "Loss";
    color = "#ef4444";
  }

  return (
    <span
      className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}
