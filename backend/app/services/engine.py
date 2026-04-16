"""
Stockfish wrapper.

Responsibilities:
- Manage a single Stockfish process per worker (initialized once, reused)
- Evaluate a FEN position and return cp/mate scores + best move
- Expose a synchronous interface (called from Celery worker, not async context)

Important: chess.engine.SimpleEngine is NOT thread-safe. Each Celery worker
process gets its own engine instance via the module-level singleton pattern.
Never share an engine instance across threads.
"""

from __future__ import annotations

import atexit
import logging
from dataclasses import dataclass

import chess
import chess.engine

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton — one engine per worker process
# ---------------------------------------------------------------------------

_engine: chess.engine.SimpleEngine | None = None


def get_engine() -> chess.engine.SimpleEngine:
    """Return the module-level Stockfish instance, initializing if needed."""
    global _engine
    if _engine is None:
        logger.info("Starting Stockfish at %s", settings.stockfish_path)
        _engine = chess.engine.SimpleEngine.popen_uci(settings.stockfish_path)
        atexit.register(_shutdown_engine)
    return _engine


def _shutdown_engine() -> None:
    global _engine
    if _engine is not None:
        try:
            _engine.quit()
        except Exception:
            pass
        _engine = None


# ---------------------------------------------------------------------------
# Public data types
# ---------------------------------------------------------------------------

@dataclass
class PositionEval:
    """
    Engine evaluation of a single position.

    cp (centipawns) and mate are both from White's absolute perspective:
    - Positive cp  → White is better
    - Negative cp  → Black is better
    - mate > 0     → White can force mate in N moves
    - mate < 0     → Black can force mate in N moves

    best_move_uci is the engine's top choice in UCI format (e.g. 'e2e4').
    best_move_san is filled in by the caller after the fact (needs board context).
    """

    cp: int | None          # None when a forced mate is on the board
    mate: int | None        # None when no forced mate
    best_move_uci: str | None


# ---------------------------------------------------------------------------
# Core evaluation function
# ---------------------------------------------------------------------------

def evaluate_position(fen: str) -> PositionEval:
    """
    Evaluate a position given a FEN string.

    Uses the configured time limit per position (STOCKFISH_TIME_LIMIT).
    Returns a PositionEval with centipawns, mate score, and best move.
    """
    engine = get_engine()
    board = chess.Board(fen)

    limit = chess.engine.Limit(time=settings.stockfish_time_limit)
    result = engine.analyse(board, limit)

    score = result["score"].white()  # always from White's perspective
    best_move_uci = result.get("pv", [None])[0]
    best_move_uci = best_move_uci.uci() if best_move_uci else None

    cp: int | None = None
    mate: int | None = None

    if score.is_mate():
        mate = score.mate()
        # Clamp cp to a large sentinel so delta calculations don't break completely
        cp = None
    else:
        cp = score.score()

    return PositionEval(cp=cp, mate=mate, best_move_uci=best_move_uci)


def uci_to_san(fen: str, uci: str) -> str | None:
    """Convert a UCI move string to SAN given the position FEN."""
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
        return board.san(move)
    except Exception:
        return None
