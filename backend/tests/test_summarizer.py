"""Tests for game summary computation and accuracy formula."""

import pytest
from app.services.summarizer import MoveRecord, compute_summary, _move_accuracy


class TestMoveAccuracy:
    def test_perfect_move_is_100(self):
        # Formula gives 99.9999 at delta=0; accept anything >= 99.99
        assert _move_accuracy(0) >= 99.99

    def test_large_blunder_is_near_zero(self):
        assert _move_accuracy(1000) < 5.0

    def test_accuracy_decreases_with_delta(self):
        assert _move_accuracy(0) > _move_accuracy(50) > _move_accuracy(200)

    def test_accuracy_never_negative(self):
        assert _move_accuracy(9999) >= 0.0

    def test_accuracy_never_over_100(self):
        assert _move_accuracy(-100) <= 100.0


def _make_moves(specs: list[tuple[str, str, int]]) -> list[MoveRecord]:
    """Helper: specs = [(color, classification, delta_cp), ...]"""
    return [
        MoveRecord(
            ply_number=i + 1,
            color=color,
            classification=cls,
            eval_delta_cp=delta,
            san="e4",
        )
        for i, (color, cls, delta) in enumerate(specs)
    ]


class TestComputeSummary:
    def test_counts_correct(self):
        moves = _make_moves([
            ("white", "blunder", 300),
            ("black", "mistake", 150),
            ("white", "inaccuracy", 80),
            ("black", "best", 0),
            ("white", "good", 30),
        ])
        summary = compute_summary(moves)
        assert summary.white.blunders == 1
        assert summary.white.mistakes == 0
        assert summary.white.inaccuracies == 1
        assert summary.black.mistakes == 1
        assert summary.black.bests == 1

    def test_accuracy_perfect_game(self):
        moves = _make_moves([
            ("white", "best", 0),
            ("black", "best", 0),
            ("white", "best", 0),
            ("black", "best", 0),
        ])
        summary = compute_summary(moves)
        assert summary.white.accuracy == 100.0
        assert summary.black.accuracy == 100.0

    def test_accuracy_game_with_blunders(self):
        moves = _make_moves([
            ("white", "best", 0),
            ("white", "blunder", 400),
        ])
        summary = compute_summary(moves)
        assert summary.white.accuracy < 80.0

    def test_critical_moment_is_worst_ply(self):
        moves = _make_moves([
            ("white", "good", 30),
            ("black", "blunder", 400),   # ply 2 — largest delta
            ("white", "inaccuracy", 80),
        ])
        summary = compute_summary(moves)
        assert summary.critical_moment_ply == 2

    def test_empty_game_returns_zero_accuracy(self):
        summary = compute_summary([])
        assert summary.white.accuracy == 0.0
        assert summary.black.accuracy == 0.0

    def test_summary_text_contains_accuracy(self):
        moves = _make_moves([
            ("white", "best", 0),
            ("black", "best", 0),
        ])
        summary = compute_summary(moves)
        assert "100%" in summary.summary_text
