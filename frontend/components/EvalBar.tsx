"use client";

interface Props {
  evalCp: number | null;
  evalMate: number | null;
}

const MATE_CP = 10_000;

/** Maps centipawns (or mate) → white's share of the bar (0–100). */
function cpToWhitePercent(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 97 : 3;
  if (cp === null) return 50;
  const clamped = Math.max(-MATE_CP, Math.min(MATE_CP, cp));
  // Sigmoid: ±100cp ≈ ±5%, ±500cp ≈ ±25%, ±1000cp ≈ ±37%
  return 50 + 50 * (2 / (1 + Math.exp(-0.003 * clamped)) - 1);
}

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  if (cp === null) return "0.0";
  const abs = Math.abs(cp);
  if (abs === 0) return "0.0";
  const sign = cp > 0 ? "+" : "−";
  return `${sign}${(abs / 100).toFixed(1)}`;
}

/**
 * Vertical eval bar — always renders white at the bottom (chess convention).
 *
 * The component fills 100% of its parent's height. Wrap it in a container
 * whose height matches the board (e.g., position: absolute; inset-y: 0).
 */
export default function EvalBar({ evalCp, evalMate }: Props) {
  const whitePercent = cpToWhitePercent(evalCp, evalMate);
  const label = formatEval(evalCp, evalMate);
  const isWhiteWinning = whitePercent >= 50;

  // Position the label near the boundary, clamped so it's always readable
  const boundaryPercent = 100 - whitePercent; // from top
  const labelTopPercent = Math.max(4, Math.min(88, boundaryPercent));

  return (
    <div
      className="relative w-full h-full rounded overflow-hidden"
      style={{ background: "#1c1c1c", minHeight: "120px" }}
    >
      {/* White section — grows from bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: `${whitePercent}%`,
          background: "#f0d9b5",
          transition: "height 350ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Eval label — floats near the boundary */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{
          top: `${labelTopPercent}%`,
          transform: "translateY(-50%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <span
          className="font-mono font-bold tabular-nums leading-none"
          style={{
            fontSize: "9px",
            color: isWhiteWinning ? "#4a7c59" : "#c0c0c0",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
