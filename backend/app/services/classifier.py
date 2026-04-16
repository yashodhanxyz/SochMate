"""
Move classification.

Converts raw engine evaluation deltas into human-readable categories.

Classification thresholds (centipawn loss from the moving player's perspective):
  best/brilliant  :   0 –   5
  excellent       :   6 –  20
  good            :  21 –  50
  inaccuracy      :  51 – 100
  mistake         : 101 – 200
  blunder         : 200+

Special handling:
- Mate-in-N transitions: if the player played into a forced mate for the opponent
  (eval_after_mate negative from player's pov) it is always a blunder.
- Mate escaped: if the player was being mated before but isn't after, it's at
  least a good move.
- Already-lost positions: when eval_before_cp < -300 from the player's perspective
  (i.e. they are losing badly), thresholds are doubled to avoid over-counting
  blunders in hopeless positions.
"""

from __future__ import annotations

from dataclasses import dataclass

# Sentinel for "effectively infinite" cp when a mate score is present
_MATE_CP = 10_000


@dataclass
class MoveClassification:
    classification: str   # best | excellent | good | inaccuracy | mistake | blunder
    eval_delta_cp: int    # centipawn loss from the moving player's perspective (positive = worse)


# ---------------------------------------------------------------------------
# Main classification entry point
# ---------------------------------------------------------------------------

def classify_move(
    eval_before_cp: int | None,
    eval_before_mate: int | None,
    eval_after_cp: int | None,
    eval_after_mate: int | None,
    color: str,  # 'white' | 'black'
) -> MoveClassification:
    """
    Classify a single move given before/after evaluations.

    All eval values are from White's absolute perspective (positive = White better).
    color indicates which player made the move.
    """
    sign = 1 if color == "white" else -1

    # Convert everything to the moving player's perspective
    before_player = _to_player_cp(eval_before_cp, eval_before_mate, sign)
    after_player = _to_player_cp(eval_after_cp, eval_after_mate, sign)

    # Centipawn loss: how much worse is the position after the move (player's pov)
    delta = before_player - after_player  # positive means we lost ground

    # --- Special cases involving mate scores ---

    # Moved into a position where opponent has forced mate
    if eval_after_mate is not None:
        after_mate_player = eval_after_mate * sign  # from player's pov
        if after_mate_player < 0:
            # Opponent now has forced mate — that's a blunder regardless of prior eval
            return MoveClassification(classification="blunder", eval_delta_cp=delta)

    # Player escaped a forced mate that was there before
    if eval_before_mate is not None:
        before_mate_player = eval_before_mate * sign
        if before_mate_player < 0 and eval_after_mate is None:
            # Was being mated, now no forced mate — at minimum a good move
            return MoveClassification(classification="good", eval_delta_cp=max(delta, 0))

    # --- Adjust thresholds for already-losing positions ---
    already_losing = before_player < -300
    thresholds = _LOOSE_THRESHOLDS if already_losing else _STANDARD_THRESHOLDS

    classification = _apply_thresholds(delta, thresholds)
    return MoveClassification(classification=classification, eval_delta_cp=delta)


# ---------------------------------------------------------------------------
# Threshold tables
# ---------------------------------------------------------------------------

_STANDARD_THRESHOLDS = [
    (5,   "best"),
    (20,  "excellent"),
    (50,  "good"),
    (100, "inaccuracy"),
    (200, "mistake"),
]

_LOOSE_THRESHOLDS = [  # doubled — avoid noise in losing positions
    (10,  "best"),
    (40,  "excellent"),
    (100, "good"),
    (200, "inaccuracy"),
    (400, "mistake"),
]


def _apply_thresholds(delta: int, thresholds: list[tuple[int, str]]) -> str:
    for limit, label in thresholds:
        if delta <= limit:
            return label
    return "blunder"


# ---------------------------------------------------------------------------
# Helper: convert white-perspective eval to player-perspective centipawns
# ---------------------------------------------------------------------------

def _to_player_cp(cp: int | None, mate: int | None, sign: int) -> int:
    """
    Return the evaluation in centipawns from the moving player's perspective.

    sign = +1 for White, -1 for Black.
    Mate scores are converted to a large sentinel value to preserve ordering.
    """
    if mate is not None:
        mate_player = mate * sign
        # Positive mate_player → we have forced mate → very good
        # Negative mate_player → opponent has forced mate → very bad
        return _MATE_CP if mate_player > 0 else -_MATE_CP

    if cp is not None:
        return cp * sign

    return 0  # fallback for truly unknown positions
