"use client";

import { useState } from "react";
import { GAMBITS, type GambitData } from "@/lib/gambits";
import GambitPractice from "@/components/GambitPractice";

// ── colour constants ──────────────────────────────────────────────────────────
const ACCENT = "var(--accent)";

// ── tiny helpers ──────────────────────────────────────────────────────────────
function ColorBadge({ color }: { color: "white" | "black" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: color === "white" ? "#f0d9b5" : "#1a1a1a",
        color: color === "white" ? "#3b2b1a" : "#f0d9b5",
        border: "1px solid",
        borderColor: color === "white" ? "#c8a96a" : "#555",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {color === "white" ? "♙ White" : "♟ Black"}
    </span>
  );
}

// ── gambit card ───────────────────────────────────────────────────────────────
function GambitCard({
  gambit,
  isActive,
  onSelect,
}: {
  gambit: GambitData;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${isActive ? ACCENT : "var(--border)"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {/* Card header */}
      <div style={{ padding: "18px 20px 0" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                {gambit.name}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontFamily: "monospace",
                }}
              >
                {gambit.eco}
              </span>
              <ColorBadge color={gambit.player_color} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {gambit.tagline}
            </p>
          </div>
        </div>

        {/* Theory */}
        <div style={{ marginTop: 12 }}>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxHeight: expanded ? "none" : "3.2em",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {gambit.theory}
          </p>
          <button
            onClick={() => setExpanded((p) => !p)}
            style={{
              fontSize: 12,
              color: ACCENT,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0 0",
            }}
          >
            {expanded ? "Show less ▲" : "Read more ▼"}
          </button>
        </div>

        {/* Key ideas — shown when expanded */}
        {expanded && (
          <div
            style={{
              marginTop: 12,
              background: "var(--surface-2)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <p
              className="font-medium mb-2 text-xs uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Key ideas
            </p>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {gambit.key_ideas.map((idea, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }}>▸</span>
                  <span style={{ color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    {idea}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {gambit.moves_uci.length} moves in main line
        </span>
        <button
          onClick={onSelect}
          style={{
            background: isActive ? "var(--surface-2)" : ACCENT,
            border: isActive ? "1px solid var(--border)" : "none",
            borderRadius: 8,
            padding: "6px 18px",
            fontSize: 13,
            fontWeight: 600,
            color: isActive ? "var(--text-secondary)" : "#fff",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          {isActive ? "↑ Hide board" : "Practice →"}
        </button>
      </div>

      {/* Inline practice board */}
      {isActive && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "0 20px 20px",
            marginTop: 0,
          }}
        >
          <GambitPractice gambit={gambit} onClose={onSelect} />
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function GambitsClient() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "white" | "black">("all");

  const visible = GAMBITS.filter(
    (g) => filter === "all" || g.player_color === filter
  );

  function toggleGambit(id: string) {
    setActiveId((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 16px 64px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)", marginBottom: 6 }}
        >
          Gambit Library
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Study the theory behind each gambit and practice the main line on an
          interactive board.
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 24 }}>
        {(["all", "white", "black"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setActiveId(null);
            }}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid",
              borderColor: filter === f ? ACCENT : "var(--border)",
              background: filter === f ? ACCENT : "var(--surface)",
              color: filter === f ? "#fff" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {f === "all" ? `All (${GAMBITS.length})` : f === "white" ? `♙ White` : `♟ Black`}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {visible.map((g) => (
          <GambitCard
            key={g.id}
            gambit={g}
            isActive={activeId === g.id}
            onSelect={() => toggleGambit(g.id)}
          />
        ))}
      </div>
    </div>
  );
}
