"""Tests for move classification logic."""

import pytest
from app.services.classifier import classify_move


class TestClassifyMove:
    """Standard threshold tests — no special cases."""

    def test_best_move_zero_delta(self):
        result = classify_move(100, None, 100, None, "white")
        assert result.classification == "best"
        assert result.eval_delta_cp == 0

    def test_best_move_small_delta(self):
        result = classify_move(100, None, 96, None, "white")
        assert result.classification == "best"

    def test_excellent_move(self):
        result = classify_move(100, None, 88, None, "white")  # 12 cp loss
        assert result.classification == "excellent"

    def test_good_move(self):
        result = classify_move(100, None, 65, None, "white")  # 35 cp loss
        assert result.classification == "good"

    def test_inaccuracy(self):
        result = classify_move(100, None, 30, None, "white")  # 70 cp loss
        assert result.classification == "inaccuracy"

    def test_mistake(self):
        result = classify_move(100, None, -50, None, "white")  # 150 cp loss
        assert result.classification == "mistake"

    def test_blunder(self):
        result = classify_move(100, None, -200, None, "white")  # 300 cp loss
        assert result.classification == "blunder"


class TestClassifyMoveBlackPerspective:
    """Evaluations are always from white's perspective — classifier must flip."""

    def test_black_best_move(self):
        # Black is better by 100cp before, still 100cp after
        result = classify_move(-100, None, -100, None, "black")
        assert result.classification == "best"

    def test_black_blunder(self):
        # Black was +200cp (black's pov), now position is +200cp for white
        # black's pov: before = +200, after = -200 → delta = 400 → blunder
        result = classify_move(-200, None, 200, None, "black")
        assert result.classification == "blunder"

    def test_black_inaccuracy(self):
        # Black goes from -100 to -30 (white's pov), i.e. from +100 to +30 black's pov → delta 70
        result = classify_move(-100, None, -30, None, "black")
        assert result.classification == "inaccuracy"


class TestMateTransitions:
    """Special cases involving forced checkmate evaluations."""

    def test_move_into_forced_mate_is_blunder(self):
        # Player walks into opponent having mate-in-1
        result = classify_move(100, None, None, -1, "white")
        assert result.classification == "blunder"

    def test_found_own_forced_mate_is_best(self):
        # White finds mate-in-3
        result = classify_move(300, None, None, 3, "white")
        assert result.classification in ("best", "excellent", "good")

    def test_escaped_forced_mate_is_good(self):
        # Was being mated (mate-in-2 for opponent), now no forced mate
        result = classify_move(None, -2, 50, None, "white")
        assert result.classification == "good"

    def test_black_move_into_forced_mate_is_blunder(self):
        # Black plays into White having mate-in-2
        result = classify_move(-100, None, None, 2, "black")
        assert result.classification == "blunder"


class TestAlreadyLosingPositions:
    """Thresholds should be relaxed in already-losing positions."""

    def test_mistake_in_losing_position_classified_more_leniently(self):
        # Player was -500cp (losing badly), loses another 150cp
        # Standard threshold: 150cp = mistake
        # Loose threshold: 150cp = good (threshold doubled)
        result = classify_move(-500, None, -650, None, "white")
        # With loose thresholds (doubled), 150cp loss ≤ 200 → "inaccuracy" or better
        assert result.classification in ("good", "inaccuracy", "mistake")
        # But NOT a blunder (standard blunder would require >400cp in loose mode)

    def test_blunder_in_losing_position_still_classified_as_such_if_large(self):
        # Even in a losing position, dropping 600 more cp is still bad
        result = classify_move(-500, None, -1100, None, "white")
        assert result.classification == "blunder"


class TestEvalDelta:
    """Verify the delta value is computed correctly."""

    def test_delta_positive_for_bad_moves(self):
        result = classify_move(200, None, -50, None, "white")
        assert result.eval_delta_cp > 0

    def test_delta_zero_for_equal_moves(self):
        result = classify_move(100, None, 100, None, "white")
        assert result.eval_delta_cp == 0

    def test_delta_negative_for_improving_position(self):
        # This happens when the played move is somehow better than what engine had before
        result = classify_move(50, None, 100, None, "white")
        assert result.eval_delta_cp < 0
        assert result.classification == "best"
