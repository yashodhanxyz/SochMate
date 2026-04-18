"use client";

interface Props {
  whiteName: string | null;
  blackName: string | null;
  whiteElo: number | null;
  blackElo: number | null;
  result: string | null;
  boardFlipped: boolean;
  onFlip: () => void;
}

function getInitial(name: string | null): string {
  return (name ?? "?").charAt(0).toUpperCase();
}

function scoreFor(result: string | null, side: "white" | "black"): string | null {
  if (!result) return null;
  if (result === "1/2-1/2") return "½";
  if (result === "1-0") return side === "white" ? "1" : "0";
  if (result === "0-1") return side === "black" ? "1" : "0";
  return null;
}

function PlayerRow({
  name,
  elo,
  result,
  side,
}: {
  name: string | null;
  elo: number | null;
  result: string | null;
  side: "white" | "black";
}) {
  const score = scoreFor(result, side);
  const isWin = score === "1";
  const isDraw = score === "½";

  const avatarBg = side === "white" ? "#e8d9b5" : "#2d2d2d";
  const avatarColor = side === "white" ? "#1a1d27" : "#c8c8c8";
  const avatarBorder = side === "white" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)";

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 select-none"
        style={{
          background: avatarBg,
          color: avatarColor,
          border: `2px solid ${avatarBorder}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        }}
      >
        {getInitial(name)}
      </div>

      {/* Name + rating */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {name ?? "Unknown"}
        </p>
        {elo !== null && (
          <p className="text-xs leading-tight" style={{ color: "var(--text-secondary)" }}>
            {elo}
          </p>
        )}
      </div>

      {/* Score */}
      {score !== null && (
        <span
          className="text-sm font-bold w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{
            background: isWin
              ? "rgba(34,197,94,0.18)"
              : isDraw
              ? "rgba(139,146,168,0.18)"
              : "rgba(239,68,68,0.15)",
            color: isWin
              ? "var(--color-best)"
              : isDraw
              ? "var(--text-secondary)"
              : "var(--color-blunder)",
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export default function PlayerHeader({
  whiteName,
  blackName,
  whiteElo,
  blackElo,
  result,
  boardFlipped,
  onFlip,
}: Props) {
  const topSide    = boardFlipped ? "white" : "black";
  const bottomSide = boardFlipped ? "black" : "white";
  const topName    = topSide === "white" ? whiteName  : blackName;
  const bottomName = bottomSide === "white" ? whiteName  : blackName;
  const topElo     = topSide === "white" ? whiteElo   : blackElo;
  const bottomElo  = bottomSide === "white" ? whiteElo   : blackElo;

  return (
    <div
      className="rounded-xl px-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Top player + flip button */}
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <PlayerRow name={topName} elo={topElo} result={result} side={topSide} />
        </div>
        <button
          type="button"
          title="Flip board"
          onClick={onFlip}
          className="w-7 h-7 rounded flex items-center justify-center text-base flex-shrink-0 transition-opacity hover:opacity-80"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          ⇅
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)" }} />

      {/* Bottom player */}
      <PlayerRow name={bottomName} elo={bottomElo} result={result} side={bottomSide} />
    </div>
  );
}
