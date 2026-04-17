"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listMyGames, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GameListItem } from "@/types/analysis";

export default function GamesClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    async function load() {
      try {
        const items = await listMyGames();
        setGames(items);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError("Could not load your games. Try refreshing.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user, router]);

  if (authLoading || loading) {
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
          style={{ background: "var(--accent)", color: "#fff" }}
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
          {games.map((game) => (
            <GameCard key={game.game_id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: GameListItem }) {
  const isPending = game.status !== "done" && game.status !== "failed";
  const isFailed = game.status === "failed";

  const userColor = game.user_color ?? "white";
  const playerName =
    userColor === "white" ? game.white_player : game.black_player;
  const opponentName =
    userColor === "white" ? game.black_player : game.white_player;

  return (
    <Link
      href={`/analyze/${game.game_id}`}
      className="block rounded-xl p-4 transition-colors"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: isFailed ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {playerName ?? "You"} vs {opponentName ?? "Opponent"}
            </span>
            {game.result && game.result !== "*" && (
              <ResultChip result={game.result} userColor={userColor} />
            )}
          </div>
          {game.opening_name && (
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {game.opening_name}
            </span>
          )}
          {game.eco_code && !game.opening_name && (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {game.eco_code}
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

        <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
          {game.status === "done" ? "View →" : ""}
        </span>
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
