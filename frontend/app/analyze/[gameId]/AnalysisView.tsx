"use client";

import { useState, useCallback, useEffect } from "react";
import { getGameStatus, getGame, ApiError } from "@/lib/api";
import type { GameData } from "@/types/analysis";
import AnalysisLoader from "@/components/AnalysisLoader";
import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import AnalysisBoard from "@/components/AnalysisBoard";
import PlayerHeader from "@/components/PlayerHeader";
import RightPanel from "@/components/RightPanel";
import EvalGraph from "@/components/EvalGraph";
import Link from "next/link";

interface Props {
  gameId: string;
}

type PageState =
  | { phase: "loading"; statusMessage?: string }
  | { phase: "done"; game: GameData }
  | { phase: "error"; message: string };

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Waiting for an analysis worker…",
  processing: "Running Stockfish on each move…",
};

export default function AnalysisView({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [currentPly, setCurrentPly] = useState(0);
  const [boardFlipped, setBoardFlipped] = useState(false);

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
        } else {
          setState({
            phase: "loading",
            statusMessage: STATUS_MESSAGES[status.status] ?? "Analyzing…",
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "error", message: "Game not found." });
        }
      }
    }
    bootstrap();
  }, [gameId]);

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
    return (
      <>
        <AnalysisLoader gameId={gameId} onDone={handleAnalysisDone} silent />
        <AnalysisSkeleton statusMessage={state.statusMessage} />
      </>
    );
  }

  const { game } = state;
  const flipBoard = () => setBoardFlipped((f) => !f);

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm w-fit"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Analyze another game
      </Link>

      {/* Main two-column layout */}
      <div className="analysis-grid">

        {/* ── Left: players + board ── */}
        <div className="flex flex-col gap-2">
          <PlayerHeader
            whiteName={game.white_player}
            blackName={game.black_player}
            whiteElo={game.white_elo}
            blackElo={game.black_elo}
            result={game.result}
            boardFlipped={boardFlipped}
            onFlip={flipBoard}
          />
          <AnalysisBoard
            moves={game.moves}
            currentPly={currentPly}
            onPlyChange={setCurrentPly}
            userColor={game.user_color}
            boardFlipped={boardFlipped}
            onFlip={flipBoard}
          />
        </div>

        {/* ── Right: tabbed panel ── */}
        <RightPanel
          game={game}
          currentPly={currentPly}
          onPlyChange={setCurrentPly}
        />
      </div>

      {/* Eval graph — full width below the board+panel grid */}
      <EvalGraph
        moves={game.moves}
        currentPly={currentPly}
        onPlyChange={setCurrentPly}
      />
    </div>
  );
}
