"use client";

interface Props {
  evalCp: number | null;
  evalMate: number | null;
}

const MATE_CP = 10_000;

function cpToWhitePercent(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 95 : 5;
  if (cp === null) return 50;
  const clamped = Math.max(-MATE_CP, Math.min(MATE_CP, cp));
  // Map cp to 0–100: 0cp = 50%, +1000cp ≈ 80%, -1000cp ≈ 20%
  return 50 + 50 * (2 / (1 + Math.exp(-0.003 * clamped)) - 1);
}

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  if (cp === null) return "0.0";
  const abs = Math.abs(cp);
  const sign = cp >= 0 ? "+" : "-";
  return `${sign}${(abs / 100).toFixed(1)}`;
}

export default function EvalBar({ evalCp, evalMate }: Props) {
  const whitePercent = cpToWhitePercent(evalCp, evalMate);
  const label = formatEval(evalCp, evalMate);
  const isWhiteWinning = whitePercent >= 50;

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: "24px" }}>
      {/* Eval label */}
      <span
        className="text-xs font-mono font-semibold tabular-nums"
        style={{
          color: isWhiteWinning ? "#e8eaf0" : "var(--text-secondary)",
          fontSize: "10px",
        }}
      >
        {label}
      </span>

      {/* Bar */}
      <div
        className="relative rounded overflow-hidden"
        style={{ width: "14px", height: "280px", background: "#2a2a2a" }}
      >
        {/* White portion (bottom) */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{
            height: `${whitePercent}%`,
            background: "#f0d9b5",
          }}
        />
      </div>
    </div>
  );
}
