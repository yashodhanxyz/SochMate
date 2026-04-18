"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOpeningStats, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OpeningStatsItem } from "@/types/analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = "games" | "accuracy" | "winrate";

function winRate(item: OpeningStatsItem): number {
  if (item.games_played === 0) return 0;
  return item.wins / item.games_played;
}

function accuracyColor(pct: number): string {
  if (pct >= 85) return "#22c55e";
  if (pct >= 70) return "#86efac";
  if (pct >= 55) return "#fbbf24";
  return "#ef4444";
}

function resultColor(wr: number): string {
  if (wr >= 0.55) return "#22c55e";
  if (wr >= 0.40) return "#fbbf24";
  return "#ef4444";
}

// ---------------------------------------------------------------------------
// Opening card
// ---------------------------------------------------------------------------

function OpeningRow({ item }: { item: OpeningStatsItem }) {
  const { wins, draws, losses, games_played, avg_accuracy, opening_name, eco_code } = item;
  const wr = winRate(item);
  const winPct  = games_played > 0 ? (wins  / games_played) * 100 : 0;
  const drawPct = games_played > 0 ? (draws / games_played) * 100 : 0;
  const lossPct = games_played > 0 ? (losses / games_played) * 100 : 0;

  const displayName = opening_name ?? eco_code ?? "Unknown Opening";
  const displayEco  = eco_code && opening_name ? eco_code : null;

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-2.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Row 1: name + stats */}
      <div className="flex items-start justify-between gap-3">
        {/* Opening name */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {displayName}
          </span>
          <div className="flex items-center gap-2">
            {displayEco && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {displayEco}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {games_played} game{games_played !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Right: accuracy + win rate */}
        <div className="flex items-center gap-4 shrink-0">
          {avg_accuracy !== null && (
            <div className="flex flex-col items-end">
              <span
                className="text-base font-bold tabular-nums leading-none"
                style={{ color: accuracyColor(avg_accuracy) }}
              >
                {avg_accuracy.toFixed(0)}%
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>accuracy</span>
            </div>
          )}
          <div className="flex flex-col items-end">
            <span
              className="text-base font-bold tabular-nums leading-none"
              style={{ color: resultColor(wr) }}
            >
              {(wr * 100).toFixed(0)}%
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>win rate</span>
          </div>
        </div>
      </div>

      {/* Row 2: W/D/L segmented bar */}
      <div className="flex flex-col gap-1">
        <div className="flex rounded overflow-hidden" style={{ height: "8px" }}>
          {winPct > 0 && (
            <div style={{ width: `${winPct}%`, background: "#22c55e" }} />
          )}
          {drawPct > 0 && (
            <div style={{ width: `${drawPct}%`, background: "#fbbf24" }} />
          )}
          {lossPct > 0 && (
            <div style={{ width: `${lossPct}%`, background: "#ef4444" }} />
          )}
        </div>
        <div className="flex items-center gap-3">
          <WdlLabel color="#22c55e" count={wins}   label="W" />
          <WdlLabel color="#fbbf24" count={draws}  label="D" />
          <WdlLabel color="#ef4444" count={losses} label="L" />
        </div>
      </div>
    </div>
  );
}

function WdlLabel({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {count} {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort tab
// ---------------------------------------------------------------------------

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
      style={{
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "#fff" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpeningsClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<OpeningStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("games");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }

    async function load() {
      try {
        setItems(await getOpeningStats());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError("Could not load opening stats. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user, router]);

  if (authLoading || loading) {
    return (
      <div className="py-20 text-center" style={{ color: "var(--text-secondary)" }}>
        Loading…
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

  // Sort
  const sorted = [...items].sort((a, b) => {
    if (sort === "accuracy") {
      return (b.avg_accuracy ?? -1) - (a.avg_accuracy ?? -1);
    }
    if (sort === "winrate") {
      return winRate(b) - winRate(a);
    }
    return b.games_played - a.games_played; // default: games
  });

  const totalGames = items.reduce((s, i) => s + i.games_played, 0);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Opening Report
          </h1>
          {totalGames > 0 && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {items.length} opening{items.length !== 1 ? "s" : ""} across {totalGames} analyzed game{totalGames !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link
          href="/games"
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          ← My Games
        </Link>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-base mb-4" style={{ color: "var(--text-secondary)" }}>
            No analyzed games yet.
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
        <>
          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Sort by:</span>
            <SortButton active={sort === "games"}    onClick={() => setSort("games")}>Most played</SortButton>
            <SortButton active={sort === "winrate"}  onClick={() => setSort("winrate")}>Win rate</SortButton>
            <SortButton active={sort === "accuracy"} onClick={() => setSort("accuracy")}>Accuracy</SortButton>
          </div>

          {/* Opening cards */}
          <div className="flex flex-col gap-3">
            {sorted.map((item, i) => (
              <OpeningRow key={`${item.eco_code}-${item.opening_name}-${i}`} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
