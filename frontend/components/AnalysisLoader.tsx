"use client";

import { useEffect, useState } from "react";
import { getGameStatus } from "@/lib/api";

interface Props {
  gameId: string;
  onDone?: () => void;
}

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Waiting for an analysis worker…",
  processing: "Running Stockfish on each move…",
};

export default function AnalysisLoader({ gameId, onDone }: Props) {
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [dots, setDots] = useState(0);

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  // Poll status
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data = await getGameStatus(gameId);
        setStatus(data.status);

        if (data.status === "done") {
          onDone?.();
          return;
        }

        if (data.status === "failed") {
          setError(data.error_message ?? "Analysis failed. Please try again.");
          return;
        }

        // Still pending or processing — poll again in 2s
        timer = setTimeout(poll, 2000);
      } catch {
        setError("Lost connection to the server. Please refresh.");
      }
    }

    poll();
    return () => clearTimeout(timer);
  }, [gameId, onDone]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-base font-medium" style={{ color: "var(--color-blunder)" }}>
          {error}
        </p>
        <a
          href="/"
          className="text-sm px-4 py-2 rounded-lg"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          ← Try another game
        </a>
      </div>
    );
  }

  const message = STATUS_MESSAGES[status] ?? "Analyzing…";
  const dotStr = ".".repeat(dots);

  return (
    <div className="flex flex-col items-center gap-8 py-20 text-center">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Analyzing your game{dotStr}
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          This usually takes 15–30 seconds.
        </p>
      </div>
    </div>
  );
}
