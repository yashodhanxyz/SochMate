"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitGame, ApiError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

type UserColor = "white" | "black" | null;

export default function GameInput() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [userColor, setUserColor] = useState<UserColor>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrl = input.trim().toLowerCase().includes("chess.com/game/");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const token = getSessionToken();
      const result = await submitGame(input.trim(), userColor, token);
      router.push(`/analyze/${result.game_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Input */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="game-input"
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Chess.com game link or PGN
        </label>
        <textarea
          id="game-input"
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            "Paste a Chess.com game URL:\nhttps://www.chess.com/game/live/...\n\nOr paste PGN directly:\n1. e4 e5 2. Nf3 Nc6 ..."
          }
          disabled={loading}
          className="w-full rounded-lg px-4 py-3 text-sm font-mono resize-y focus:outline-none transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            minHeight: "120px",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "var(--accent)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        />
      </div>

      {/* Color selector — show for URLs where we can infer, always show for PGN */}
      <div className="flex flex-col gap-2">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          I played as
        </span>
        <div className="flex gap-3">
          {(["white", "black", null] as UserColor[]).map((c) => (
            <button
              key={String(c)}
              type="button"
              onClick={() => setUserColor(c)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background:
                  userColor === c ? "var(--accent)" : "var(--surface-2)",
                color:
                  userColor === c ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${userColor === c ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {c === null ? "Auto-detect" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        {isUrl && userColor === null && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            We&apos;ll detect your color from the URL automatically.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--color-blunder)",
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!input.trim() || loading}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
        style={{
          background: input.trim() && !loading ? "var(--accent)" : "var(--surface-2)",
          color: input.trim() && !loading ? "#fff" : "var(--text-secondary)",
          cursor: input.trim() && !loading ? "pointer" : "not-allowed",
          border: "none",
        }}
      >
        {loading ? "Submitting…" : "Analyze Game →"}
      </button>
    </form>
  );
}
