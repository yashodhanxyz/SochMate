"""
Chess.com Public API client.

Responsibilities:
- Fetch PGN from a Chess.com game URL
- Parse the game ID and usernames from a Chess.com URL
- Handle rate limiting (Chess.com asks for a User-Agent and rate-limits aggressively)

Chess.com URL formats:
  https://www.chess.com/game/live/96789456789
  https://www.chess.com/game/daily/12345678
  https://chess.com/game/live/96789456789

Chess.com Public API used:
  GET https://api.chess.com/pub/game/{game_id}
  → returns { "pgn": "...", "url": "...", ... }

Note: This is an undocumented endpoint but widely used. The documented route is
  GET /pub/player/{username}/games/{YYYY}/{MM}
which returns all games for a player in a month. If the direct game endpoint
fails, we fall back to prompting the user to paste the PGN directly.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from app.config import settings

# Chess.com asks for a descriptive User-Agent in their API terms
_USER_AGENT = "SochMate/0.1 (chess analysis tool; contact@sochmate.app)"

# Regex to extract game ID from chess.com URLs
_GAME_URL_RE = re.compile(
    r"chess\.com/game/(live|daily)/(\d+)",
    re.IGNORECASE,
)


class ChessComError(Exception):
    """Raised when the Chess.com API returns an error or unexpected response."""


def is_chess_com_url(text: str) -> bool:
    """Return True if the text looks like a Chess.com game URL."""
    return bool(_GAME_URL_RE.search(text))


def extract_game_id(url: str) -> tuple[str, str]:
    """
    Extract (game_type, game_id) from a Chess.com URL.

    Returns e.g. ('live', '96789456789') or ('daily', '12345678').
    Raises ChessComError if the URL format is not recognised.
    """
    match = _GAME_URL_RE.search(url)
    if not match:
        raise ChessComError(
            f"Could not extract a game ID from URL: {url}. "
            "Expected format: chess.com/game/live/{{id}} or chess.com/game/daily/{{id}}"
        )
    return match.group(1), match.group(2)


def fetch_pgn_from_url(url: str) -> tuple[str, str]:
    """
    Fetch the PGN for a Chess.com game URL.

    Returns (pgn_text, chess_com_game_id).
    Raises ChessComError on API failures or unexpected responses.

    Uses the undocumented /pub/game/{id} endpoint.
    Falls back to an error with a clear message if the endpoint is unavailable,
    so the UI can prompt the user to paste the PGN manually.
    """
    game_type, game_id = extract_game_id(url)
    pgn = _fetch_game_direct(game_id)
    return pgn, game_id


_RETRY_DELAYS = [1.0, 2.0, 4.0]  # seconds between retries on 429 / transient errors


def _fetch_game_direct(game_id: str) -> str:
    """
    Try the undocumented GET /pub/game/{id} endpoint.
    Retries up to 3 times on 429 and transient network errors with backoff.
    """
    import time

    endpoint = f"{settings.chess_com_api_base}/game/{game_id}"
    last_exc: Exception | None = None

    for attempt, delay in enumerate([0.0] + _RETRY_DELAYS, start=1):
        if delay:
            time.sleep(delay)

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(endpoint, headers={"User-Agent": _USER_AGENT})
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt > len(_RETRY_DELAYS):
                raise ChessComError(
                    f"Network error fetching game {game_id} after {attempt} attempts: {exc}"
                ) from exc
            continue  # retry

        if response.status_code == 404:
            raise ChessComError(
                f"Game {game_id} was not found on Chess.com. "
                "The game may be private or the ID is incorrect. "
                "Please paste the PGN directly."
            )

        if response.status_code == 429:
            if attempt > len(_RETRY_DELAYS):
                raise ChessComError(
                    "Chess.com rate limit hit. Please wait a moment and try again."
                )
            continue  # retry after backoff

        if response.status_code >= 500:
            if attempt > len(_RETRY_DELAYS):
                raise ChessComError(
                    f"Chess.com server error ({response.status_code}). Please try again later."
                )
            continue  # retry on 5xx

        if response.status_code != 200:
            raise ChessComError(
                f"Chess.com API returned status {response.status_code} for game {game_id}."
            )

        data = response.json()
        pgn = data.get("pgn")

        if not pgn:
            raise ChessComError(
                f"Chess.com returned a response for game {game_id} but it contained no PGN. "
                "Please paste the PGN manually."
            )

        return pgn

    raise ChessComError(
        f"Failed to fetch game {game_id} from Chess.com after {len(_RETRY_DELAYS) + 1} attempts."
    )


def fetch_player_games_pgn(username: str, year: int, month: int) -> list[str]:
    """
    Fetch all games for a player in a given month.

    Returns a list of PGN strings (one per game).
    This is the documented Chess.com Public API endpoint.
    """
    endpoint = f"{settings.chess_com_api_base}/player/{username}/games/{year}/{month:02d}"

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(endpoint, headers={"User-Agent": _USER_AGENT})
    except httpx.RequestError as exc:
        raise ChessComError(f"Network error fetching games for {username}: {exc}") from exc

    if response.status_code == 404:
        raise ChessComError(
            f"No games found for player '{username}' in {year}/{month:02d}. "
            "Check the username and date."
        )

    if response.status_code != 200:
        raise ChessComError(
            f"Chess.com API returned {response.status_code} for player {username}."
        )

    games = response.json().get("games", [])
    return [g["pgn"] for g in games if "pgn" in g]
