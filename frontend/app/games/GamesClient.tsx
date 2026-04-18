"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listMyGames, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GameListItem } from "@/types/analysis";
import ImportChessCom from "@/components/ImportChessCom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeControl(tc: string | null): string {
  if (!tc || tc === "-") return "";
  const [base, inc] = tc.split("+");
  const mins = Math.floor(parseInt(base) / 60);
  if (isNaN(mins)) return tc;
  if (inc && parseInt(inc) > 0) return `${mins}+${inc}`;
  return `${mins} min`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

function getResultInfo(
  result: string | null,
  userColor: "white" | "black"
): { label: string; color: string; bg: string; accent: string } {
  if (!result || result === "*")
    return { label: "–", color: "var(--text-secondary)", bg: "transparent", accent: "var(--border)" };
  const won =
    (result === "1-0" && userColor === "white") ||
    (result === "0-1" && userColor === "black");
  const lost =
    (result === "1-0" && userColor === "black") ||
    (result === "0-1" && userColor === "white");
  if (won)  return { label: "Win",  color: "#22c55e", bg: "rgba(34,197,94,0.12)",  accent: "#22c55e" };
  if (lost) return { label: "Loss", color: "#ef4444", bg: "rgba(239,68,68,0.12)",  accent: "#ef4444" };
  return       { label: "Draw", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", accent: "#fbbf24" };
}

function accuracyColor(pct: number): string {
  if (pct >= 85) return "#22c55e";
  if (pct >= 70) return "#86efac";
  if (pct >= 55) return "#fbbf24";
  return "#ef4444";
}

function SourceBadge({ source }: { source: GameListItem["source"] }) {
  const map = {
    chess_com:  { label: "Chess.com", color: "#f97316" },
    lichess:    { label: "Lichess",   color: "#a0aec0" },
    manual_pgn: { label: "PGN",       color: "var(--text-secondary)" },
  };
  const { label, color } = map[source] ?? map.manual_pgn;
  return (
    <span className="text-xs font-medium" style={{ color }}>{label}</span>
  );
}

// ---------------------------------------------------------------------------
// Game card
// ---------------------------------------------------------------------------

function GameCard({ game }: { game: GameListItem }) {
  const isPending = game.status === "pending" || game.status === "processing";
  const isFailed  = game.status === "failed";
  const isDone    = game.status === "done";

  const userColor    = game.user_color ?? "white";
  const opponentColor: "white" | "black" = userColor === "white" ? "black" : "white";
  const playerName   = userColor === "white" ? game.white_player : game.black_player;
  const opponentName = opponentColor === "white" ? game.white_player : game.black_player;
  const userElo      = userColor === "white" ? game.white_elo : game.black_elo;
  const opponentElo  = opponentColor === "white" ? game.white_elo : game.black_elo;

  const resultInfo = getResultInfo(game.result, userColor);

  const userAccuracy =
    isDone
      ? (userColor === "white" ? game.accuracy_white : game.accuracy_black)
      : null;
  const userBlunders =
    isDone
      ? (userColor === "white" ? game.blunders_white : game.blunders_black) ?? 0
      : null;
  const userMistakes =
    isDone
      ? (userColor === "white" ? game.mistakes_white : game.mistakes_black) ?? 0
      : null;
  const userInaccuracies =
    isDone
      ? (userColor === "white" ? game.inaccuracies_white : game.inaccuracies_black) ?? 0
      : null;

  const tc   = formatTimeControl(game.time_control);
  const date = formatDate(game.played_at ?? game.created_at);

  return (
    <Link
      href={`/analyze/${game.game_id}`}
      className="block rounded-xl overflow-hidden transition-all hover:scale-[1.005]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: isFailed ? 0.55 : 1,
      }}
    >
      <div className="flex">
        {/* Left accent bar */}
        <div
          className="w-1 shrink-0"
          style={{ background: isDone ? resultInfo.accent : "var(--border)" }}
        />

        {/* Card body */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-2 min-w-0">

          {/* Row 1: players + result + accuracy */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              {/* You */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {playerName ?? "You"}
                </span>
                {userElo && (
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>({userElo})</span>
                )}
              </div>
              {/* Opponent */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  vs {opponentName ?? "Opponent"}
                </span>
                {opponentElo && (
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>({opponentElo})</span>
                )}
              </div>
            </div>

            {/* Right: result + accuracy */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Accuracy */}
              {userAccuracy !== null && userAccuracy !== undefined && (
                <div className="flex flex-col items-end">
                  <span
                    className="text-base font-bold tabular-nums leading-none"
                    style={{ color: accuracyColor(userAccuracy) }}
                  >
                    {userAccuracy.toFixed(0)}%
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>accuracy</span>
                </div>
              )}

              {/* Result badge */}
              {isDone && game.result && game.result !== "*" && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: resultInfo.bg, color: resultInfo.color }}
                >
                  {resultInfo.label}
                </span>
              )}
              {isPending && (
                <span className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                  Analyzing…
                </span>
              )}
              {isFailed && (
                <span className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  Failed
                </span>
              )}
            </div>
          </div>

          {/* Row 2: opening */}
          {(game.opening_name || game.eco_code) && (
            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {game.opening_name ?? game.eco_code}
            </p>
          )}

          {/* Row 3: mistake pills + meta */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Mistake counts */}
            {isDone && (
              <div className="flex items-center gap-1.5">
                {(userBlunders ?? 0) > 0 && (
                  <StatPill count={userBlunders!} label="blunder" color="#ef4444" />
                )}
                {(userMistakes ?? 0) > 0 && (
                  <StatPill count={userMistakes!} label="mistake" color="#f97316" />
                )}
                {(userInaccuracies ?? 0) > 0 && (
                  <StatPill count={userInaccuracies!} label="inaccuracy" color="#fbbf24" />
                )}
                {(userBlunders ?? 0) === 0 && (userMistakes ?? 0) === 0 && (userInaccuracies ?? 0) === 0 && (
                  <span className="text-xs font-medium" style={{ color: "#22c55e" }}>Clean game ✓</span>
                )}
              </div>
            )}

            {/* Meta: source · time · date */}
            <div className="flex items-center gap-2 ml-auto">
              <SourceBadge source={game.source} />
              {tc && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>· {tc}</span>}
              {date && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>· {date}</span>}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ background: color + "18", color }}
    >
      {count} {count === 1 ? label : label + "s"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GamesClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    try {
      setGames(await listMyGames());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
      else setError("Could not load your games. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    loadGames();
  }, [authLoading, user, router, loadGames]);

  // Called after a successful Chess.com import — refresh the list
  const handleImported = useCallback(() => {
    loadGames();
  }, [loadGames]);

  if (authLoading || loading) {
    return <div className="py-20 text-center" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  }
  if (error) {
    return <div className="py-20 text-center" style={{ color: "var(--color-blunder)" }}>{error}</div>;
  }

  const done    = games.filter(g => g.status === "done");
  const pending = games.filter(g => g.status === "pending" || g.status === "processing");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            My Games
          </h1>
          {done.length > 0 && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {done.length} game{done.length !== 1 ? "s" : ""} analyzed
            </p>
          )}
        </div>
        <Link
          href="/"
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          + Analyze New
        </Link>
      </div>

      {/* Chess.com import card */}
      <ImportChessCom onImported={handleImported} />

      {games.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-base mb-4" style={{ color: "var(--text-secondary)" }}>
            No games analyzed yet.
          </p>
          <Link href="/" className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}>
            Analyze your first game →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}>
              In progress
            </p>
          )}
          {pending.map(g => <GameCard key={g.game_id} game={g} />)}

          {done.length > 0 && pending.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-wider mt-2"
              style={{ color: "var(--text-secondary)" }}>
              Completed
            </p>
          )}
          {done.map(g => <GameCard key={g.game_id} game={g} />)}
        </div>
      )}
    </div>
  );
}
