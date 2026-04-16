"""Tests for PGN parsing and board reconstruction."""

import pytest
from app.services.pgn_parser import PGNParseError, parse_pgn

# A minimal valid PGN (Scholar's mate in 4 moves)
SCHOLARS_MATE_PGN = """[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1400"]
[ECO "C20"]
[Opening "King's Pawn Game"]
[Date "2024.03.15"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0"""

# A longer game (Immortal Game excerpt — first 10 moves)
IMMORTAL_GAME_PGN = """[Event "Casual Game"]
[White "Anderssen"]
[Black "Kieseritzky"]
[Result "1-0"]
[Date "1851.??.??"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6
6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 1-0"""

# PGN with no headers (just moves)
HEADERLESS_PGN = "1. d4 d5 2. c4 c6 3. Nc3 Nf6 *"

# PGN with embedded comments (should be stripped cleanly)
COMMENTED_PGN = """[White "Test"]
[Black "Test"]
[Result "*"]

1. e4 {Good opening} e5 {Response} 2. Nf3 Nc6 *"""


class TestParsePGN:
    def test_basic_parse_returns_correct_ply_count(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        # White plays 4 moves, Black plays 3 (game ends on Qxf7#) = 7 plies
        assert len(result.plies) == 7

    def test_headers_extracted_correctly(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        assert result.white_player == "Alice"
        assert result.black_player == "Bob"
        assert result.result == "1-0"
        assert result.white_elo == 1500
        assert result.black_elo == 1400
        assert result.eco_code == "C20"
        assert result.opening_name == "King's Pawn Game"

    def test_date_parsed(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        assert result.played_at is not None
        assert result.played_at.year == 2024
        assert result.played_at.month == 3
        assert result.played_at.day == 15

    def test_partial_date_returns_none(self):
        result = parse_pgn(IMMORTAL_GAME_PGN)
        assert result.played_at is None  # "1851.??.??" is not parseable

    def test_ply_numbering(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        ply_numbers = [p.ply_number for p in result.plies]
        assert ply_numbers == list(range(1, 8))

    def test_move_numbers(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        # e4(1) e5(1) Bc4(2) Nc6(2) Qh5(3) Nf6(3) Qxf7#(4) — 7 plies
        move_numbers = [p.move_number for p in result.plies]
        assert move_numbers == [1, 1, 2, 2, 3, 3, 4]

    def test_colors_alternate_correctly(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        colors = [p.color for p in result.plies]
        assert colors == ["white", "black", "white", "black", "white", "black", "white"]

    def test_first_move_san(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        assert result.plies[0].san == "e4"
        assert result.plies[1].san == "e5"

    def test_fen_before_is_starting_position_for_ply1(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        starting_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        assert result.plies[0].fen_before == starting_fen

    def test_fen_after_matches_next_fen_before(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        for i in range(len(result.plies) - 1):
            assert result.plies[i].fen_after == result.plies[i + 1].fen_before

    def test_uci_format(self):
        result = parse_pgn(SCHOLARS_MATE_PGN)
        # e4 = e2e4, e5 = e7e5
        assert result.plies[0].uci == "e2e4"
        assert result.plies[1].uci == "e7e5"

    def test_headerless_pgn_parses(self):
        result = parse_pgn(HEADERLESS_PGN)
        assert len(result.plies) == 6
        assert result.white_player is None
        assert result.result is None   # "*" is treated as "no result" (game ongoing)

    def test_commented_pgn_parses(self):
        result = parse_pgn(COMMENTED_PGN)
        assert len(result.plies) == 4

    def test_multi_game_pgn_uses_first_game(self):
        multi = SCHOLARS_MATE_PGN + "\n\n" + HEADERLESS_PGN
        result = parse_pgn(multi)
        # Should only parse the first game (Scholar's Mate = 7 plies)
        assert len(result.plies) == 7

    def test_empty_input_raises(self):
        with pytest.raises(PGNParseError):
            parse_pgn("")

    def test_garbage_input_raises(self):
        with pytest.raises(PGNParseError):
            parse_pgn("this is not a chess game at all")

    def test_illegal_move_truncates_silently(self):
        # python-chess logs the illegal SAN and truncates the mainline at that point.
        # We analyze the legal portion rather than raising — this is intentional.
        illegal_pgn = "1. e4 e5 2. Bh6 *"
        result = parse_pgn(illegal_pgn)
        # Only the 2 legal plies (e4, e5) are returned
        assert len(result.plies) == 2

    def test_longer_game_ply_count(self):
        result = parse_pgn(IMMORTAL_GAME_PGN)
        # 10 moves × 2 = 20 plies
        assert len(result.plies) == 20
