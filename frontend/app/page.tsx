import GameInput from "@/components/GameInput";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "70vh" }}>
      <div className="w-full max-w-xl flex flex-col gap-8">
        {/* Hero */}
        <div className="text-center flex flex-col gap-3">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Analyze your chess game
          </h1>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            Paste a Chess.com link or PGN. Get move-by-move feedback powered
            by Stockfish.
          </p>
        </div>

        {/* Input card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <GameInput />
        </div>

        {/* Sub-note */}
        <p className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          No account needed · Analysis takes ~20 seconds · Results saved for your session
        </p>
      </div>
    </div>
  );
}
