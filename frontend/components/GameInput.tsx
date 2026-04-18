"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitGame, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type UserColor = "white" | "black" | null;

export default function GameInput() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [input, setInput] = useState("");
  const [userColor, setUserColor] = useState<UserColor>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = input.trim().toLowerCase();
  const isUrl =
    trimmed.includes("chess.com/game/") ||
    /lichess\.org\/[a-z0-9]{8}/i.test(trimmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitGame(input.trim(), userColor);
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

  // Show sign-in prompt if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Sign in to analyze games and track your improvement.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Create free account
          </Link>
        </div>
      </div>
    );
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
          Chess.com or Lichess game link, or PGN
        </label>
        <textarea
          id="game-input"
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            "Paste a game URL:\nhttps://www.chess.com/game/live/...\nhttps://lichess.org/abc123de\n\nOr paste PGN directly:\n1. e4 e5 2. Nf3 Nc6 ..."
          }
          disabled={loading}
          className="w-full rounded-lg px-4 py-3 text-sm font-mono resize-y focus:outline-none transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            minHeight: "120px",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Color selector */}
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
            We&apos;ll detect your color from the URL automatically.{" "}
            For Lichess, share the link from your perspective (e.g. lichess.org/…/white).
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
