import type { MoveClassification } from "@/types/analysis";

export const CLASSIFICATION_CONFIG: Record<
  MoveClassification,
  { label: string; color: string; bg: string; symbol: string }
> = {
  best:        { label: "Best",        color: "#22c55e", bg: "rgba(34,197,94,0.12)",   symbol: "★" },
  excellent:   { label: "Excellent",   color: "#86efac", bg: "rgba(134,239,172,0.12)", symbol: "!" },
  good:        { label: "Good",        color: "#6ee7b7", bg: "rgba(110,231,183,0.12)", symbol: "✓" },
  inaccuracy:  { label: "Inaccuracy",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  symbol: "?!" },
  mistake:     { label: "Mistake",     color: "#f97316", bg: "rgba(249,115,22,0.12)",  symbol: "?" },
  blunder:     { label: "Blunder",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   symbol: "??" },
};

export function getConfig(cls: MoveClassification | null | undefined) {
  if (!cls) return null;
  return CLASSIFICATION_CONFIG[cls] ?? null;
}
