"use client";

import { useState, useCallback, useEffect } from "react";
import { getGameStatus, getGame, ApiError } from "@/lib/api";
import type { GameData } from "@/types/analysis";
import AnalysisLoader from "@/components/AnalysisLoader";
import AnalysisBoard from "@/components/AnalysisBoard";
import MoveList from "@/components/MoveList";
import MoveFeedback from "@/components/MoveFeedback";
import GameSummary from "@/components/GameSummary";
import Link from "next/link";

interface Props {
  gameId: string;
}

type PageState =
  | { phase: "loading" }
  | { phase: "done"; game: GameData }
  | { phase: "error"; message: string };

export default function AnalysisView({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [currentPly, setCurrentPly] = useState(0);

  // On mount: check if already done (avoids unnecessary loader flash)
  useEffect(() => {
    async function bootstrap() {
      try {
        const status = await getGameStatus(gameId);
        if (status.status === "done") {
          const game = await getGame(gameId);
          setState({ phase: "done", game });
        } else if (status.status === "failed") {
          setState({
            phase: "error",
            message: status.error_message ?? "Analysis failed.",
          });
        }
        // pending/processing → stay in loading phase, AnalysisLoader will poll
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "error", message: "Game not found." });
        }
        // Other errors: stay in loading, AnalysisLoader will handle them
      }
    }
    bootstrap();
  }, [gameId]);

  // Called by AnalysisLoader when status becomes "done"
  const handleAnalysisDone = useCallback(async () => {
    try {
      const game = await getGame(gameId);
      setState({ phase: "done", game });
    } catch {
      setState({ phase: "error", message: "Failed to load analysis results." });
    }
  }, [gameId]);

  if (state.phase === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p style={{ color: "var(--color-blunder)" }}>{state.message}</p>
        <Link
          href="/"
          className="text-sm px-4 py-2 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          ← Analyze another game
        </Link>
      </div>
    );
  }

  if (state.phase === "loading") {
    return <AnalysisLoader gameId={gameId} onDone={handleAnalysisDone} />;
  }

  const { game } = state;
  const currentMove = currentPly > 0 ? game.moves[currentPly - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm w-fit"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Analyze another game
      </Link>

      {/* Main layout: stacked on mobile, side-by-side on desktop (lg+) */}
      <div className="analysis-grid">
        {/* Left: board + feedback */}
        <div className="flex flex-col gap-4">
          <AnalysisBoard
            moves={game.moves}
            currentPly={currentPly}
            onPlyChange={setCurrentPly}
            userColor={game.user_color}
          />
          <MoveFeedback move={currentMove} />
        </div>

        {/* Right: move list */}
        <div className="flex flex-col gap-4">
          <MoveList
            moves={game.moves}
            currentPly={currentPly}
            onPlyChange={setCurrentPly}
          />
        </div>
      </div>

      {/* Summary — full width below */}
      {game.summary && (
        <GameSummary
          game={game}
          summary={game.summary}
          userColor={game.user_color}
        />
      )}
    </div>
  );
}
