"""
PGN parsing and board reconstruction.

Responsibilities:
- Validate that a string is parseable PGN
- Extract game headers (players, result, ECO, elos, date, time control)
- Reconstruct board state at every half-move (ply)
- Return a structured list of plies ready for engine evaluation

This module has no I/O and no DB dependencies — pure data transformation.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import datetime

import chess
import chess.pgn


@dataclass
class PlyData:
    """All data for a single half-move, before engine evaluation is added."""

    ply_number: int        # 1-indexed
    move_number: int       # chess move number (1, 2, 3…)
    color: str             # 'white' | 'black'
    san: str               # Standard Algebraic Notation, e.g. 'Nxe5'
    uci: str               # UCI string, e.g. 'g1f3'
    fen_before: str        # FEN of position before this move
    fen_after: str         # FEN of position after this move


@dataclass
class ParsedGame:
    """Structured result of parsing a PGN string."""

    white_player: str | None
    black_player: str | None
    result: str | None          # '1-0' | '0-1' | '1/2-1/2' | '*'
    time_control: str | None
    eco_code: str | None
    opening_name: str | None
    white_elo: int | None
    black_elo: int | None
    played_at: datetime | None
    plies: list[PlyData]


class PGNParseError(ValueError):
    """Raised when the input cannot be parsed as valid PGN."""


def parse_pgn(pgn_text: str) -> ParsedGame:
    """
    Parse a PGN string and return a ParsedGame.

    Handles:
    - Standard PGN with or without headers
    - PGN with embedded comments (stripped)
    - PGN with NAG annotations (ignored)
    - Multi-game PGN files (only the first game is used)

    Raises PGNParseError if the input is not valid PGN or has no moves.
    """
    pgn_text = pgn_text.strip()
    if not pgn_text:
        raise PGNParseError("Input is empty.")

    game = _read_first_game(pgn_text)
    plies = _reconstruct_plies(game)

    if not plies:
        raise PGNParseError("Game has no moves.")

    return ParsedGame(
        white_player=_header(game, "White"),
        black_player=_header(game, "Black"),
        result=_header(game, "Result"),
        time_control=_header(game, "TimeControl"),
        eco_code=_header(game, "ECO"),
        opening_name=_header(game, "Opening"),
        white_elo=_int_header(game, "WhiteElo"),
        black_elo=_int_header(game, "BlackElo"),
        played_at=_parse_date(game),
        plies=plies,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_first_game(pgn_text: str) -> chess.pgn.Game:
    """Read the first game from a PGN string, stripping comments first."""
    stream = io.StringIO(pgn_text)
    game = chess.pgn.read_game(stream)
    if game is None:
        raise PGNParseError("Could not parse PGN — no valid game found.")
    return game


def _reconstruct_plies(game: chess.pgn.Game) -> list[PlyData]:
    """
    Walk the game's main line and collect ply data.
    Skips variations — only the moves actually played are reconstructed.

    Handles:
    - Null moves (UCI "0000") — skipped silently
    - Illegal moves — raises PGNParseError with the offending move number
    """
    plies: list[PlyData] = []
    board = game.board()
    ply_number = 0

    for node in game.mainline():
        move = node.move

        # python-chess sets move to None when it encounters an illegal SAN in read_game
        if move is None:
            fullmove = board.fullmove_number
            color = "White" if board.turn == chess.WHITE else "Black"
            raise PGNParseError(
                f"Illegal or unreadable move at {color} move {fullmove}. "
                "The PGN may be corrupted or from an unsupported variant."
            )

        # Skip null moves (e.g. from some PGN exporters)
        if move == chess.Move.null():
            continue

        # Validate legality before pushing
        if move not in board.legal_moves:
            fullmove = board.fullmove_number
            color = "White" if board.turn == chess.WHITE else "Black"
            raise PGNParseError(
                f"Illegal move at {color} move {fullmove}: {move.uci()}. "
                "The PGN may be corrupted or from an unsupported variant."
            )

        fen_before = board.fen()
        try:
            san = board.san(move)
        except Exception:
            san = move.uci()  # fallback if SAN generation fails

        uci = move.uci()
        color = "white" if board.turn == chess.WHITE else "black"
        move_number = board.fullmove_number

        board.push(move)
        fen_after = board.fen()

        ply_number += 1
        plies.append(
            PlyData(
                ply_number=ply_number,
                move_number=move_number,
                color=color,
                san=san,
                uci=uci,
                fen_before=fen_before,
                fen_after=fen_after,
            )
        )

    return plies


def _header(game: chess.pgn.Game, key: str) -> str | None:
    value = game.headers.get(key)
    if value in (None, "?", "", "-", "*"):
        return None
    return value


def _int_header(game: chess.pgn.Game, key: str) -> int | None:
    raw = _header(game, key)
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _parse_date(game: chess.pgn.Game) -> datetime | None:
    """Parse PGN Date header (format: YYYY.MM.DD) into a datetime."""
    raw = _header(game, "Date")
    if raw is None:
        return None
    try:
        return datetime.strptime(raw, "%Y.%m.%d")
    except ValueError:
        # Partial dates like '2024.??.??' — return None
        return None
