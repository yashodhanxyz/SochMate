"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOpeningStats, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OpeningStatsItem, ColorStats } from "@/types/analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tab = "all" | "gambits";
type SortKey = "games" | "accuracy" | "winrate";

function winRate(wins: number, games: number): number {
  return games > 0 ? wins / games : 0;
}

function tierInfo(wr: number): { label: string; color: string; bg: string } {
  if (wr >= 0.55) return { label: "Strong",      color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  if (wr >= 0.35) return { label: "Developing",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  return               { label: "Needs Work",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
}

function accuracyColor(pct: number): string {
  if (pct >= 85) return "#22c55e";
  if (pct >= 70) return "#86efac";
  if (pct >= 55) return "#fbbf24";
  return "#ef4444";
}

/** Win rate to use for the tier badge — gambit player color stats if available */
function effectiveWinRate(item: OpeningStatsItem): number {
  if (item.is_gambit && item.gambit_color) {
    const cs = item.gambit_color === "white" ? item.as_white : item.as_black;
    if (cs && cs.games_played > 0) return winRate(cs.wins, cs.games_played);
  }
  return winRate(item.wins, item.games_played);
}

// ---------------------------------------------------------------------------
// ColorRow — a single W/D/L row for one color
// ---------------------------------------------------------------------------

function ColorRow({
  label,
  cs,
  isAttacker,
}: {
  label: string;
  cs: ColorStats;
  isAttacker?: boolean;
}) {
  const { wins, draws, losses, games_played, avg_accuracy } = cs;
  const winPct  = (wins  / games_played) * 100;
  const drawPct = (draws / games_played) * 100;
  const lossPct = (losses / games_played) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-medium"
            style={{ color: isAttacker ? "var(--text-primary)" : "var(--text-secondary)" }}
          >
            {label}
          </span>
          {isAttacker && (
            <span
              className="text-xs px-1.5 rounded font-medium"
              style={{ background: "var(--accent)", color: "#fff", fontSize: "10px" }}
            >
              attacker
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {games_played}g · {wins}W {draws}D {losses}L
          </span>
        </div>
        {avg_accuracy !== null && (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: accuracyColor(avg_accuracy) }}
          >
            {avg_accuracy.toFixed(0)}% acc
          </span>
        )}
      </div>
      <div className="flex rounded overflow-hidden" style={{ height: "5px" }}>
        {winPct  > 0 && <div style={{ width: `${winPct}%`,  background: "#22c55e" }} />}
        {drawPct > 0 && <div style={{ width: `${drawPct}%`, background: "#fbbf24" }} />}
        {lossPct > 0 && <div style={{ width: `${lossPct}%`, background: "#ef4444" }} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GambitCard
// ---------------------------------------------------------------------------

function GambitCard({ item }: { item: OpeningStatsItem }) {
  const wr = effectiveWinRate(item);
  const tier = tierInfo(wr);
  const displayName = item.opening_name ?? item.eco_code ?? "Unknown";
  const displayEco  = item.eco_code && item.opening_name ? item.eco_code : null;

  const whiteIsAttacker = item.gambit_color === "white";
  const blackIsAttacker = item.gambit_color === "black";

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
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
              {item.games_played} game{item.games_played !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {/* Tier badge */}
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
          style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}30` }}
        >
          {tier.label}
        </span>
      </div>

      {/* Color breakdown */}
      <div className="flex flex-col gap-2.5">
        {item.as_white && (
          <ColorRow
            label="As White"
            cs={item.as_white}
            isAttacker={whiteIsAttacker}
          />
        )}
        {item.as_black && (
          <ColorRow
            label="As Black"
            cs={item.as_black}
            isAttacker={blackIsAttacker}
          />
        )}
        {/* If we only have overall stats (no color split yet) */}
        {!item.as_white && !item.as_black && (
          <ColorRow
            label="Overall"
            cs={{
              games_played: item.games_played,
              wins: item.wins,
              draws: item.draws,
              losses: item.losses,
              avg_accuracy: item.avg_accuracy,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpeningRow — compact card for the "All Openings" tab
// ---------------------------------------------------------------------------

function OpeningRow({ item }: { item: OpeningStatsItem }) {
  const { wins, draws, losses, games_played, avg_accuracy, opening_name, eco_code } = item;
  const wr = winRate(wins, games_played);
  const tier = tierInfo(wr);
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </span>
            {item.is_gambit && (
              <span
                className="text-xs px-1.5 rounded font-medium shrink-0"
                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", fontSize: "10px" }}
              >
                gambit
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {displayEco && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {displayEco}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {games_played} game{games_played !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {avg_accuracy !== null && (
            <div className="flex flex-col items-end">
              <span className="text-base font-bold tabular-nums leading-none" style={{ color: accuracyColor(avg_accuracy) }}>
                {avg_accuracy.toFixed(0)}%
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>accuracy</span>
            </div>
          )}
          <span
            className="text-xs font-bold px-2 py-1 rounded-lg"
            style={{ background: tier.bg, color: tier.color }}
          >
            {tier.label}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex rounded overflow-hidden" style={{ height: "6px" }}>
          {winPct  > 0 && <div style={{ width: `${winPct}%`,  background: "#22c55e" }} />}
          {drawPct > 0 && <div style={{ width: `${drawPct}%`, background: "#fbbf24" }} />}
          {lossPct > 0 && <div style={{ width: `${lossPct}%`, background: "#ef4444" }} />}
        </div>
        <div className="flex items-center gap-3">
          {[["#22c55e", wins, "W"], ["#fbbf24", draws, "D"], ["#ef4444", losses, "L"]].map(([color, count, label]) => (
            <div key={label as string} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color as string }} />
              <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {count} {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort + filter helpers
// ---------------------------------------------------------------------------

function SortButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
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
  const [tab, setTab] = useState<Tab>("all");
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
    return <div className="py-20 text-center" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  }
  if (error) {
    return <div className="py-20 text-center" style={{ color: "var(--color-blunder)" }}>{error}</div>;
  }

  const gambits = items.filter(i => i.is_gambit);
  const totalGames = items.reduce((s, i) => s + i.games_played, 0);
  const gambitsCount = gambits.reduce((s, i) => s + i.games_played, 0);

  // "Needs Work" gambits: ≥2 games as gambit player, win rate < 40%
  const needsWork = gambits.filter(item => {
    if (!item.gambit_color) return false;
    const cs = item.gambit_color === "white" ? item.as_white : item.as_black;
    if (!cs || cs.games_played < 2) return false;
    return winRate(cs.wins, cs.games_played) < 0.40;
  });

  function sortedItems(list: OpeningStatsItem[]) {
    return [...list].sort((a, b) => {
      if (sort === "accuracy") return (b.avg_accuracy ?? -1) - (a.avg_accuracy ?? -1);
      if (sort === "winrate")  return effectiveWinRate(b) - effectiveWinRate(a);
      return b.games_played - a.games_played;
    });
  }

  return (
    <div className="flex flex-col gap-0 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Opening Report
          </h1>
          {totalGames > 0 && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {items.length} opening{items.length !== 1 ? "s" : ""} · {totalGames} games analyzed
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
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-base mb-4" style={{ color: "var(--text-secondary)" }}>No analyzed games yet.</p>
          <Link href="/" className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
            Analyze your first game →
          </Link>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div
            className="flex rounded-t-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "none" }}
          >
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              All Openings ({items.length})
            </TabButton>
            <TabButton active={tab === "gambits"} onClick={() => setTab("gambits")}>
              Gambits {gambits.length > 0 ? `(${gambitsCount} games)` : ""}
            </TabButton>
          </div>

          {/* Tab content */}
          <div
            className="rounded-b-xl p-4 flex flex-col gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "none" }}
          >
            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Sort by:</span>
              <SortButton active={sort === "games"}    onClick={() => setSort("games")}>Most played</SortButton>
              <SortButton active={sort === "winrate"}  onClick={() => setSort("winrate")}>Win rate</SortButton>
              <SortButton active={sort === "accuracy"} onClick={() => setSort("accuracy")}>Accuracy</SortButton>
            </div>

            {/* ── All Openings tab ── */}
            {tab === "all" && (
              <div className="flex flex-col gap-3">
                {sortedItems(items).map((item, i) => (
                  <OpeningRow key={`${item.eco_code}-${i}`} item={item} />
                ))}
              </div>
            )}

            {/* ── Gambits tab ── */}
            {tab === "gambits" && (
              <>
                {gambits.length === 0 ? (
                  <div className="py-10 text-center" style={{ color: "var(--text-secondary)" }}>
                    No gambit games found yet. Play some gambits and analyze them!
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* "Needs Work" section */}
                    {needsWork.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                            ⚠ Study these
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            — as attacker, win rate below 40%
                          </span>
                        </div>
                        {needsWork.map((item, i) => (
                          <GambitCard key={`nw-${item.eco_code}-${i}`} item={item} />
                        ))}
                        <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px" }} />
                      </div>
                    )}

                    {/* All gambits */}
                    <div className="flex flex-col gap-3">
                      {sortedItems(gambits).map((item, i) => (
                        <GambitCard key={`g-${item.eco_code}-${i}`} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
