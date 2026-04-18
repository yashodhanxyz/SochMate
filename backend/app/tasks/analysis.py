"""
Celery task: analyze_game

This is the core analysis pipeline, executed asynchronously in a worker.

Pipeline:
  1. Load game from DB
  2. Parse PGN
  3. For each ply: evaluate position before + after, get best move
  4. Classify each move
  5. Generate explanation
  6. Compute game summary
  7. Persist all results
  8. Update game.status = 'done'
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models.game import Game
from app.models.game_summary import GameSummary
from app.models.move import Move
from app.services.classifier import classify_move
from app.services.engine import evaluate_position, uci_to_san
from app.services.explainer import explain_move
from app.services.opening import detect_opening
from app.services.patterns import detect_pattern
from app.services.pgn_parser import PGNParseError, parse_pgn
from app.services.summarizer import MoveRecord, compute_summary
from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)

# Celery workers use a synchronous SQLAlchemy engine (not async)
_sync_engine = create_engine(
    settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://"),
    pool_size=5,
    max_overflow=10,
)
SyncSession = sessionmaker(bind=_sync_engine)


@celery.task(name="analyze_game", bind=True)
def analyze_game(self, game_id: str) -> dict:
    """
    Analyze a game and persist results.

    Called with the UUID string of an existing Game row.
    Returns a minimal dict with status and counts for the Celery result backend.
    """
    start_time = time.monotonic()

    with SyncSession() as session:
        game = session.get(Game, uuid.UUID(game_id))
        if game is None:
            logger.error("analyze_game called with unknown game_id=%s", game_id)
            return {"status": "failed", "error": "game not found"}

        try:
            _run_pipeline(session, game, start_time)
            return {"status": "done", "game_id": game_id}

        except Exception as exc:
            logger.exception("Analysis failed for game %s", game_id)
            game.status = "failed"
            game.error_message = str(exc)[:500]
            session.commit()
            return {"status": "failed", "error": str(exc)}


def _run_pipeline(session: Session, game: Game, start_time: float) -> None:
    game.status = "processing"
    session.commit()

    # --- Step 1: Parse PGN ---
    try:
        parsed = parse_pgn(game.pgn_raw)
    except PGNParseError as exc:
        raise ValueError(f"PGN parse error: {exc}") from exc

    # Backfill game metadata from PGN headers if not already set
    if not game.white_player:
        game.white_player = parsed.white_player
    if not game.black_player:
        game.black_player = parsed.black_player
    game.result = parsed.result
    game.time_control = parsed.time_control
    game.eco_code = parsed.eco_code
    game.opening_name = parsed.opening_name
    game.white_elo = parsed.white_elo
    game.black_elo = parsed.black_elo
    if parsed.played_at and not game.played_at:
        game.played_at = parsed.played_at

    # Backfill opening info via EPD lookup when PGN headers don't include it
    if not game.eco_code or not game.opening_name:
        try:
            fens = [ply.fen_after for ply in parsed.plies]
            detected_eco, detected_name = detect_opening(fens)
            if detected_eco and not game.eco_code:
                game.eco_code = detected_eco
            if detected_name and not game.opening_name:
                game.opening_name = detected_name
        except Exception:
            logger.warning("Opening detection failed for game %s", game.id, exc_info=True)

    session.commit()

    # Guard: refuse to analyze excessively long games
    if len(parsed.plies) > settings.max_moves_per_game:
        raise ValueError(
            f"Game has {len(parsed.plies)} half-moves, which exceeds the "
            f"limit of {settings.max_moves_per_game}. This is unusual and "
            "may indicate a corrupt PGN."
        )

    # --- Steps 2–5: Evaluate, classify, explain each ply ---
    move_records: list[MoveRecord] = []
    move_rows: list[Move] = []

    for ply in parsed.plies:
        # Evaluate position BEFORE the move was played
        eval_before = evaluate_position(ply.fen_before)

        # Evaluate position AFTER the move was played
        eval_after = evaluate_position(ply.fen_after)

        # Best move SAN (needs fen_before context)
        best_move_san = (
            uci_to_san(ply.fen_before, eval_before.best_move_uci)
            if eval_before.best_move_uci
            else None
        )

        # Classify
        result = classify_move(
            eval_before_cp=eval_before.cp,
            eval_before_mate=eval_before.mate,
            eval_after_cp=eval_after.cp,
            eval_after_mate=eval_after.mate,
            color=ply.color,
        )

        # Detect missed tactical pattern (only when player deviated from best)
        pattern_tag: str | None = None
        if (
            eval_before.best_move_uci
            and eval_before.best_move_uci != ply.uci
            and result.classification in ("blunder", "mistake", "inaccuracy")
        ):
            pattern_tag = detect_pattern(ply.fen_before, eval_before.best_move_uci)

        # Explain
        explanation = explain_move(
            classification=result.classification,
            san=ply.san,
            best_move_san=best_move_san,
            eval_delta_cp=result.eval_delta_cp,
            eval_before_cp=eval_before.cp,
            eval_after_cp=eval_after.cp,
            eval_before_mate=eval_before.mate,
            eval_after_mate=eval_after.mate,
            color=ply.color,
        )

        move_rows.append(
            Move(
                game_id=game.id,
                ply_number=ply.ply_number,
                move_number=ply.move_number,
                color=ply.color,
                san=ply.san,
                uci=ply.uci,
                fen_before=ply.fen_before,
                fen_after=ply.fen_after,
                eval_before_cp=eval_before.cp,
                eval_after_cp=eval_after.cp,
                eval_before_mate=eval_before.mate,
                eval_after_mate=eval_after.mate,
                eval_delta_cp=result.eval_delta_cp,
                best_move_san=best_move_san,
                best_move_uci=eval_before.best_move_uci,
                classification=result.classification,
                explanation=explanation,
                pattern_tag=pattern_tag,
            )
        )

        move_records.append(
            MoveRecord(
                ply_number=ply.ply_number,
                color=ply.color,
                classification=result.classification,
                eval_delta_cp=result.eval_delta_cp,
                san=ply.san,
            )
        )

    # --- Step 6: Compute summary ---
    summary_data = compute_summary(move_records)

    elapsed_ms = int((time.monotonic() - start_time) * 1000)

    summary_row = GameSummary(
        game_id=game.id,
        accuracy_white=summary_data.white.accuracy,
        accuracy_black=summary_data.black.accuracy,
        blunders_white=summary_data.white.blunders,
        blunders_black=summary_data.black.blunders,
        mistakes_white=summary_data.white.mistakes,
        mistakes_black=summary_data.black.mistakes,
        inaccuracies_white=summary_data.white.inaccuracies,
        inaccuracies_black=summary_data.black.inaccuracies,
        critical_moment_ply=summary_data.critical_moment_ply,
        summary_text=summary_data.summary_text,
        analysis_time_ms=elapsed_ms,
    )

    # --- Step 7: Persist everything in one transaction ---
    session.add_all(move_rows)
    session.add(summary_row)
    game.status = "done"
    session.commit()

    logger.info(
        "Game %s analyzed: %d plies in %dms",
        game.id,
        len(move_rows),
        elapsed_ms,
    )
