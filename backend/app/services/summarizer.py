"""
Game summary computation.

Takes the fully classified and explained move list and computes:
- Accuracy score per player (Chess.com-compatible formula)
- Classification counts per player
- Critical moment (ply with the largest centipawn swing)
- A brief narrative summary paragraph

No I/O — pure data transformation over a list of dicts/dataclasses.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class MoveRecord:
    """Minimal move data needed for summarization."""
    ply_number: int
    color: str               # 'white' | 'black'
    classification: str      # blunder | mistake | inaccuracy | good | excellent | best
    eval_delta_cp: int | None
    san: str


@dataclass
class PlayerSummary:
    accuracy: float          # 0.0 – 100.0
    blunders: int
    mistakes: int
    inaccuracies: int
    goods: int
    excellents: int
    bests: int


@dataclass
class GameSummaryData:
    white: PlayerSummary
    black: PlayerSummary
    critical_moment_ply: int | None   # ply_number with the biggest absolute delta
    summary_text: str


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def compute_summary(moves: list[MoveRecord]) -> GameSummaryData:
    white_moves = [m for m in moves if m.color == "white"]
    black_moves = [m for m in moves if m.color == "black"]

    white = _player_summary(white_moves)
    black = _player_summary(black_moves)
    critical_ply = _find_critical_moment(moves)
    text = _build_summary_text(white, black, critical_ply, moves)

    return GameSummaryData(
        white=white,
        black=black,
        critical_moment_ply=critical_ply,
        summary_text=text,
    )


# ---------------------------------------------------------------------------
# Accuracy formula
# ---------------------------------------------------------------------------

def _player_summary(player_moves: list[MoveRecord]) -> PlayerSummary:
    accuracy = _compute_accuracy(player_moves)
    counts = _count_classifications(player_moves)
    return PlayerSummary(accuracy=accuracy, **counts)


def _compute_accuracy(moves: list[MoveRecord]) -> float:
    """
    Chess.com-compatible accuracy formula.

    Uses the win-percentage model:
      win_pct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)

    Accuracy for a move = max(0, 103.1668... * exp(-0.04354 * (win_before - win_after)) - 3.1669)
    Overall accuracy = mean across all moves with available cp evaluations.

    Reference: https://www.chess.com/article/view/chess-com-accuracy
    """
    if not moves:
        return 0.0

    accuracies: list[float] = []
    for m in moves:
        if m.eval_delta_cp is None:
            continue
        acc = _move_accuracy(m.eval_delta_cp)
        accuracies.append(acc)

    if not accuracies:
        return 0.0

    return round(sum(accuracies) / len(accuracies), 2)


def _move_accuracy(delta_cp: int) -> float:
    """
    Map a single move's centipawn loss to a 0–100 accuracy value.

    delta_cp is the loss from the player's perspective (positive = worse).
    A delta of 0 → 100% accuracy. Large deltas → approach 0%.
    """
    # Clamp: don't let a single blunder skew to crazy negative
    delta_cp = max(0, min(delta_cp, 1000))
    raw = 103.1668 * math.exp(-0.04354 * delta_cp) - 3.1669
    return max(0.0, min(100.0, raw))


def _count_classifications(moves: list[MoveRecord]) -> dict:
    counts = {
        "blunders": 0,
        "mistakes": 0,
        "inaccuracies": 0,
        "goods": 0,
        "excellents": 0,
        "bests": 0,
    }
    for m in moves:
        key = {
            "blunder": "blunders",
            "mistake": "mistakes",
            "inaccuracy": "inaccuracies",
            "good": "goods",
            "excellent": "excellents",
            "best": "bests",
        }.get(m.classification)
        if key:
            counts[key] += 1
    return counts


# ---------------------------------------------------------------------------
# Critical moment
# ---------------------------------------------------------------------------

def _find_critical_moment(moves: list[MoveRecord]) -> int | None:
    """Return the ply_number of the move with the largest centipawn loss."""
    candidates = [m for m in moves if m.eval_delta_cp is not None]
    if not candidates:
        return None
    worst = max(candidates, key=lambda m: abs(m.eval_delta_cp))  # type: ignore[arg-type]
    return worst.ply_number


# ---------------------------------------------------------------------------
# Narrative summary text
# ---------------------------------------------------------------------------

def _build_summary_text(
    white: PlayerSummary,
    black: PlayerSummary,
    critical_ply: int | None,
    moves: list[MoveRecord],
) -> str:
    lines: list[str] = []

    lines.append(
        f"White played with {white.accuracy:.0f}% accuracy "
        f"({white.blunders} blunder{'s' if white.blunders != 1 else ''}, "
        f"{white.mistakes} mistake{'s' if white.mistakes != 1 else ''}, "
        f"{white.inaccuracies} inaccurac{'ies' if white.inaccuracies != 1 else 'y'})."
    )
    lines.append(
        f"Black played with {black.accuracy:.0f}% accuracy "
        f"({black.blunders} blunder{'s' if black.blunders != 1 else ''}, "
        f"{black.mistakes} mistake{'s' if black.mistakes != 1 else ''}, "
        f"{black.inaccuracies} inaccurac{'ies' if black.inaccuracies != 1 else 'y'})."
    )

    if critical_ply is not None:
        critical_move = next((m for m in moves if m.ply_number == critical_ply), None)
        if critical_move:
            move_num = (critical_ply + 1) // 2   # ply_number → chess move number
            color = critical_move.color.capitalize()
            san = critical_move.san
            lines.append(
                f"The critical moment was move {move_num} ({color}: {san}), "
                f"which had the largest impact on the position."
            )

    return " ".join(lines)
