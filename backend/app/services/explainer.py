"""
Rule-based move explanation generator.

Produces a short, human-readable sentence for each move based on:
- The classification (blunder / mistake / inaccuracy / good / excellent / best)
- The centipawn delta
- The best move alternative (if different from played move)
- Whether a mate was missed or caused

In V2 this module will be replaced by a Claude API call that receives the same
structured context and returns richer natural-language explanations.
The function signature is intentionally stable so the swap is surgical.
"""

from __future__ import annotations

import random


def explain_move(
    classification: str,
    san: str,
    best_move_san: str | None,
    eval_delta_cp: int,
    eval_before_cp: int | None,
    eval_after_cp: int | None,
    eval_before_mate: int | None,
    eval_after_mate: int | None,
    color: str,
) -> str:
    """
    Generate a one-sentence explanation for a move.

    Returns a plain string. Never raises — falls back to a generic sentence.
    """
    try:
        return _generate(
            classification=classification,
            san=san,
            best_move_san=best_move_san,
            eval_delta_cp=eval_delta_cp,
            eval_before_cp=eval_before_cp,
            eval_after_cp=eval_after_cp,
            eval_before_mate=eval_before_mate,
            eval_after_mate=eval_after_mate,
            color=color,
        )
    except Exception:
        return _fallback(classification)


# ---------------------------------------------------------------------------
# Internal logic
# ---------------------------------------------------------------------------

def _generate(
    classification: str,
    san: str,
    best_move_san: str | None,
    eval_delta_cp: int,
    eval_before_cp: int | None,
    eval_after_cp: int | None,
    eval_before_mate: int | None,
    eval_after_mate: int | None,
    color: str,
) -> str:
    # Mate-related special cases take priority
    if eval_after_mate is not None:
        sign = 1 if color == "white" else -1
        mate_player = (eval_after_mate or 0) * sign
        if mate_player < 0:
            opponent_in = abs(eval_after_mate)
            alt = f" {best_move_san} would avoid this." if best_move_san and best_move_san != san else ""
            return (
                f"This move allows the opponent to force checkmate in {opponent_in}.{alt}"
            )
        elif mate_player > 0:
            return f"Excellent! This sets up a forced checkmate in {abs(eval_after_mate)}."

    if eval_before_mate is not None:
        sign = 1 if color == "white" else -1
        before_mate_player = (eval_before_mate or 0) * sign
        if before_mate_player > 0:
            # Player had a forced mate and played something else
            in_n = abs(eval_before_mate)
            alt = f" {best_move_san} would have delivered checkmate in {in_n}." if best_move_san else ""
            return f"A missed forced checkmate.{alt}"

    alt_phrase = _alt_phrase(san, best_move_san)
    delta_phrase = _delta_phrase(eval_delta_cp)

    if classification == "blunder":
        return random.choice([
            f"A blunder. {delta_phrase}{alt_phrase}",
            f"This move makes the position much worse. {delta_phrase}{alt_phrase}",
            f"A serious mistake. {delta_phrase}{alt_phrase}",
        ])

    if classification == "mistake":
        return random.choice([
            f"A mistake that gives the opponent an advantage. {alt_phrase}",
            f"This lets the opponent seize the initiative. {alt_phrase}",
        ])

    if classification == "inaccuracy":
        return random.choice([
            f"A slight inaccuracy. {alt_phrase}",
            f"Not the best choice — there was a more precise option. {alt_phrase}",
        ])

    if classification == "good":
        return random.choice([
            "A solid, reasonable move.",
            "Good move — maintains the balance.",
            "A fine choice.",
        ])

    if classification == "excellent":
        return random.choice([
            "Excellent move! This is the sharpest option here.",
            "Very strong — finds the best continuation.",
        ])

    if classification == "best":
        return random.choice([
            "Best move! Engine agrees this is the top choice.",
            "Perfect move.",
            "This is exactly what the engine recommends.",
        ])

    return _fallback(classification)


def _alt_phrase(san: str, best_move_san: str | None) -> str:
    """Return a sentence about the better alternative, or empty string."""
    if best_move_san and best_move_san != san:
        return f"{best_move_san} was the better option."
    return ""


def _delta_phrase(eval_delta_cp: int) -> str:
    """Return a rough description of how much ground was lost."""
    pawns = abs(eval_delta_cp) / 100
    if pawns >= 3:
        return f"About {pawns:.0f} pawns were lost in value."
    elif pawns >= 1:
        return f"About {pawns:.1f} pawns were lost in value."
    return ""


def _fallback(classification: str) -> str:
    return f"This move was classified as {classification}."
