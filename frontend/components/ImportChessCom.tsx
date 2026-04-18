"use client";

import { useState } from "react";
import { importChessCom, ApiError } from "@/lib/api";

interface Props {
  /** Called after a successful import so the parent can refresh the game list. */
  onImported: (queued: number) => void;
  /** Pre-fill the username if the user has imported before. */
  savedUsername?: string | null;
}

const GAME_COUNT_OPTIONS = [10, 20, 50, 100];

type Phase =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; queued: number; skipped: number; username: string }
  | { state: "error"; message: string };

export default function ImportChessCom({ onImported, savedUsername }: Props) {
  const [username, setUsername] = useState(savedUsername ?? "");
  const [maxGames, setMaxGames] = useState(20);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

  async function handleImport() {
    const trimmed = username.trim();
    if (!trimmed) return;
    setPhase({ state: "loading" });
    try {
      const result = await importChessCom(trimmed, maxGames);
      setPhase({ state: "success", ...result });
      if (result.queued > 0) onImported(result.queued);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      setPhase({ state: "error", message: msg });
    }
  }

  const isLoading = phase.state === "loading";

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid #f97316",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>♟</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Import from Chess.com
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Pull your recent games and queue them all for analysis at once
          </p>
        </div>
      </div>

      {/* Result banner */}
      {phase.state === "success" && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
        >
          <span style={{ color: "#22c55e" }}>
            ✓ Queued <strong>{phase.queued}</strong> new game{phase.queued !== 1 ? "s" : ""} for analysis
          </span>
          {phase.skipped > 0 && (
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}· {phase.skipped} already imported
            </span>
          )}
          {phase.queued === 0 && phase.skipped > 0 && (
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}— all your recent games are already here!
            </span>
          )}
        </div>
      )}

      {phase.state === "error" && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
        >
          {phase.message}
        </div>
      )}

      {/* Form */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Username */}
        <input
          type="text"
          placeholder="Chess.com username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (phase.state !== "idle") setPhase({ state: "idle" });
          }}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && handleImport()}
          disabled={isLoading}
          className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />

        {/* Game count selector */}
        <select
          value={maxGames}
          onChange={(e) => setMaxGames(Number(e.target.value))}
          disabled={isLoading}
          className="text-sm rounded-lg px-3 py-2"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            minWidth: "110px",
          }}
        >
          {GAME_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Last {n} games
            </option>
          ))}
        </select>

        {/* Import button */}
        <button
          type="button"
          onClick={handleImport}
          disabled={isLoading || !username.trim()}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-opacity"
          style={{
            background: isLoading || !username.trim() ? "var(--surface-2)" : "#f97316",
            color: isLoading || !username.trim() ? "var(--text-secondary)" : "#fff",
            border: "1px solid transparent",
            cursor: isLoading || !username.trim() ? "default" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isLoading ? "Importing…" : "Import games"}
        </button>
      </div>
    </div>
  );
}
