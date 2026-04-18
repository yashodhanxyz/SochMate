"use client";

import dynamic from "next/dynamic";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Thin shimmer bar */
function ShimmerBar({ h = "1rem", w = "100%" }: { h?: string; w?: string }) {
  return (
    <div
      className="shimmer"
      style={{ height: h, width: w, borderRadius: "5px" }}
    />
  );
}

/** Left column: player rows + board + nav controls */
function SkeletonBoard() {
  return (
    <div className="flex flex-col gap-3">
      {/* Top player shimmer */}
      <div className="flex items-center gap-2 py-2 px-2 rounded-lg"
        style={{ background: "var(--surface-2)" }}>
        <div className="shimmer w-4 h-4 rounded-sm flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-1">
          <ShimmerBar h="0.85rem" w="55%" />
          <ShimmerBar h="0.65rem" w="30%" />
        </div>
      </div>

      {/* Board + (placeholder) eval bar */}
      <div className="flex items-start gap-2">
        {/* Eval bar placeholder */}
        <div
          className="shimmer flex-shrink-0 rounded-md"
          style={{ width: "14px", height: "400px" }}
        />
        {/* Board */}
        <div className="flex-1">
          <Chessboard
            options={{
              position: STARTING_FEN,
              allowDragging: false,
              boardStyle: {
                borderRadius: "8px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              },
              darkSquareStyle: { backgroundColor: "#4a7c59" },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
            }}
          />
        </div>
      </div>

      {/* Bottom player shimmer */}
      <div className="flex items-center gap-2 py-2 px-2 rounded-lg"
        style={{ background: "var(--surface-2)" }}>
        <div className="shimmer w-4 h-4 rounded-sm flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-1">
          <ShimmerBar h="0.85rem" w="60%" />
          <ShimmerBar h="0.65rem" w="28%" />
        </div>
      </div>

      {/* Nav buttons shimmer */}
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="shimmer w-9 h-9 rounded"
          />
        ))}
      </div>
    </div>
  );
}

/** Right column: move list shimmer */
function SkeletonMoveList() {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <ShimmerBar h="1rem" w="40%" />
      <div style={{ height: "1px", background: "var(--border)", margin: "2px 0" }} />

      {/* Move rows */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <ShimmerBar h="0.75rem" w="2rem" />
          <ShimmerBar h="0.75rem" w="4rem" />
          <ShimmerBar h="0.75rem" w="4rem" />
        </div>
      ))}
    </div>
  );
}

/** Below grid: summary shimmer */
function SkeletonSummary() {
  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Accuracy cards row */}
      <div className="flex gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex-1 flex flex-col gap-2 p-4 rounded-lg"
            style={{ background: "var(--surface-2)" }}
          >
            <ShimmerBar h="0.75rem" w="50%" />
            <ShimmerBar h="2rem"    w="60%" />
            <ShimmerBar h="0.65rem" w="80%" />
          </div>
        ))}
      </div>
      {/* Stat row */}
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 flex flex-col gap-2 p-3 rounded-lg"
            style={{ background: "var(--surface-2)" }}
          >
            <ShimmerBar h="0.65rem" w="55%" />
            <ShimmerBar h="1.2rem" w="35%" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  /** Status message shown below the board */
  statusMessage?: string;
}

export default function AnalysisSkeleton({ statusMessage }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Subtle analysing badge */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--accent)" }}
        />
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {statusMessage ?? "Analyzing your game…"}
        </span>
      </div>

      {/* Main grid */}
      <div className="analysis-grid">
        <SkeletonBoard />
        <SkeletonMoveList />
      </div>

      {/* Summary */}
      <SkeletonSummary />
    </div>
  );
}
