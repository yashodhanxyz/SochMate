"""
Tactical pattern detector.

Given a board position (FEN) and the engine's best move (UCI), detect which
tactical pattern the move exploits.  Called only when the player deviated from
the best move (blunder / mistake / inaccuracy), so the tag means:

    "The best move here was a <pattern> — you missed it."

Patterns detected (in priority order):
    back_rank        — forced back-rank checkmate
    fork             — the move attacks two or more valuable opponent pieces
    hanging          — the move captures a completely undefended piece
    pin              — the move creates a new absolute pin against the king
    skewer           — a slider attacks a heavy piece with a lesser piece behind
    discovered_attack— moving uncovers an attack by a piece behind

Returns a single string tag or None.  Never raises — all errors are caught
and return None so a broken detector never fails a game analysis.
"""

from __future__ import annotations

import chess

# ---------------------------------------------------------------------------
# Piece values (in "units" — pawn = 1)
# ---------------------------------------------------------------------------
_VAL: dict[int, int] = {
    chess.PAWN:   1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK:   5,
    chess.QUEEN:  9,
    chess.KING:   99,
}

_SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_pattern(fen: str, move_uci: str) -> str | None:
    """
    Detect the primary tactical pattern enabled by *move_uci* in position *fen*.

    Returns a lowercase label string or None.
    """
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            return None

        for fn in (
            _back_rank,
            _skewer,          # before fork: check-skewer mustn't be labelled fork
            _fork,
            _hanging,
            _pin,
            _discovered_attack,
        ):
            tag = fn(board, move)
            if tag:
                return tag

        return None
    except Exception:  # noqa: BLE001  — detector must never crash analysis
        return None


# ---------------------------------------------------------------------------
# Individual detectors
# ---------------------------------------------------------------------------

def _back_rank(board: chess.Board, move: chess.Move) -> str | None:
    """Best move delivers checkmate on the opponent's back rank."""
    after = _push(board, move)
    if not after.is_checkmate():
        return None
    king_sq = after.king(after.turn)
    if king_sq is not None and chess.square_rank(king_sq) in (0, 7):
        return "back_rank"
    return None


def _fork(board: chess.Board, move: chess.Move) -> str | None:
    """
    After the move the landing piece simultaneously attacks 2+ opponent pieces
    worth ≥ a knight, OR gives check while also attacking another valuable piece.
    """
    after = _push(board, move)
    to_sq = move.to_square
    moved = after.piece_at(to_sq)
    if moved is None:
        return None

    opponent = not moved.color
    targets = [
        sq for sq in after.attacks(to_sq)
        if (p := after.piece_at(sq)) and p.color == opponent and _VAL[p.piece_type] >= 3
    ]

    # King-in-check counts as one of the fork targets
    if after.is_check():
        if len(targets) >= 1:
            return "fork"
    elif len(targets) >= 2:
        return "fork"

    return None


def _hanging(board: chess.Board, move: chess.Move) -> str | None:
    """
    Best move captures a piece that is completely undefended, or captures a
    piece worth more than the attacker (winning exchange).
    """
    if not board.is_capture(move):
        return None

    # En-passant: skip (the pawn was defended by virtue of being a pawn)
    target_sq = move.to_square
    captured = board.piece_at(target_sq)
    if captured is None:
        return None  # en-passant — not worth tagging

    opponent = not board.turn
    defenders = board.attackers(opponent, target_sq)

    if not defenders:
        return "hanging"

    # Winning exchange: moving piece < captured piece
    mover = board.piece_at(move.from_square)
    if mover and _VAL[captured.piece_type] > _VAL[mover.piece_type]:
        return "hanging"

    return None


def _pin(board: chess.Board, move: chess.Move) -> str | None:
    """
    After the move, one or more new absolute pins exist against the opponent's king.
    Only flags pins on pieces worth ≥ a knight (ignores pawn pins).
    """
    opponent = not board.turn

    # Collect squares already pinned before the move
    pinned_before = {
        sq
        for sq in chess.SQUARES
        if (p := board.piece_at(sq))
        and p.color == opponent
        and board.is_pinned(opponent, sq)
    }

    after = _push(board, move)

    for sq in chess.SQUARES:
        p = after.piece_at(sq)
        if (
            p
            and p.color == opponent
            and sq not in pinned_before
            and after.is_pinned(opponent, sq)
            and _VAL[p.piece_type] >= 3
        ):
            return "pin"

    return None


def _skewer(board: chess.Board, move: chess.Move) -> str | None:
    """
    The moving piece is a slider that attacks a heavy opponent piece (rook /
    queen / king), and along the same ray behind that piece sits another piece.
    """
    mover = board.piece_at(move.from_square)
    if mover is None or mover.piece_type not in _SLIDERS:
        return None

    after = _push(board, move)
    to_sq = move.to_square
    opponent = not mover.color

    for first_sq in after.attacks(to_sq):
        first = after.piece_at(first_sq)
        if first is None or first.color != opponent:
            continue
        if _VAL[first.piece_type] < 5:   # only skewer through rook / queen / king
            continue

        # Walk along the ray beyond first_sq
        direction = _ray_step(to_sq, first_sq)
        if direction is None:
            continue

        cursor = first_sq + direction
        while _on_board(cursor, first_sq, direction):
            behind = after.piece_at(cursor)
            if behind is not None:
                if behind.color == opponent and _VAL[behind.piece_type] < _VAL[first.piece_type]:
                    return "skewer"
                break
            cursor += direction

    return None


def _discovered_attack(board: chess.Board, move: chess.Move) -> str | None:
    """
    Moving a piece unblocks one of our own sliders, which now attacks a new
    valuable opponent piece it couldn't reach before.
    """
    from_sq = move.from_square
    to_sq = move.to_square
    us = board.turn
    opponent = not us

    # Collect our sliders (excluding the piece being moved)
    our_sliders = (
        board.pieces(chess.ROOK,   us)
        | board.pieces(chess.BISHOP, us)
        | board.pieces(chess.QUEEN,  us)
    ) - chess.SquareSet([from_sq])

    after = _push(board, move)

    for slider_sq in our_sliders:
        old_attacks = board.attacks(slider_sq)
        new_attacks = after.attacks(slider_sq)
        for sq in new_attacks - old_attacks:
            p = after.piece_at(sq)
            if p and p.color == opponent and _VAL[p.piece_type] >= 3:
                return "discovered_attack"

    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _push(board: chess.Board, move: chess.Move) -> chess.Board:
    b = board.copy(stack=False)
    b.push(move)
    return b


def _ray_step(origin: int, target: int) -> int | None:
    """
    Return the integer step (delta) to walk from origin toward target along a
    rank, file, or diagonal.  Returns None if they're not aligned.
    """
    of, or_ = chess.square_file(origin), chess.square_rank(origin)
    tf, tr  = chess.square_file(target),  chess.square_rank(target)

    df = tf - of
    dr = tr - or_

    if df == 0 and dr == 0:
        return None
    if df != 0 and dr != 0 and abs(df) != abs(dr):
        return None   # not on a diagonal

    sf = (1 if df > 0 else -1) if df != 0 else 0
    sr = (1 if dr > 0 else -1) if dr != 0 else 0
    return sr * 8 + sf


def _on_board(sq: int, prev: int, step: int) -> bool:
    """Guard against wrapping around board edges."""
    if not (0 <= sq < 64):
        return False
    # Detect file-wrap: if file distance jumps > 1 we crossed the board edge
    prev_file = chess.square_file(prev)
    cur_file  = chess.square_file(sq)
    if abs(cur_file - prev_file) > 1:
        return False
    return True
