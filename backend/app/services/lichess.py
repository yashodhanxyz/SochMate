"""
Lichess public API client.

Responsibilities:
- Detect Lichess game URLs
- Extract the game ID (and optional player-color hint) from a URL
- Fetch the PGN via the documented export endpoint

Lichess URL formats:
  https://lichess.org/abc123de          – game from white's perspective (default)
  https://lichess.org/abc123de/white    – explicitly white's perspective
  https://lichess.org/abc123de/black    – black's perspective
  https://lichess.org/abc123de#12       – move number fragment (ignored)

Export API:
  GET https://lichess.org/game/export/{id}?opening=true&clocks=false&evals=false
  Returns: PGN text directly (Content-Type: application/x-chess-pgn)
  No auth required for public games.
"""

from __future__ import annotations

import re

import httpx

_USER_AGENT = "SochMate/0.1 (chess analysis tool; contact@sochmate.app)"

# Lichess game IDs are exactly 8 alphanumeric characters.
_GAME_URL_RE = re.compile(
    r"lichess\.org/([a-zA-Z0-9]{8})(?:/(white|black))?",
    re.IGNORECASE,
)

_EXPORT_BASE = "https://lichess.org/game/export"


class LichessError(Exception):
    """Raised when the Lichess API returns an error or unexpected response."""


def is_lichess_url(text: str) -> bool:
    """Returns True only when the entire input is a Lichess game URL (no newlines)."""
    stripped = text.strip()
    return "\n" not in stripped and bool(_GAME_URL_RE.search(stripped))


def extract_game_id(url: str) -> tuple[str, str | None]:
    """
    Returns (game_id, color_hint).
    color_hint is 'white' | 'black' | None (when not present in URL).
    """
    match = _GAME_URL_RE.search(url)
    if not match:
        raise LichessError(
            f"Could not extract a game ID from URL: {url}. "
            "Expected format: lichess.org/{{8-char-id}} "
            "or lichess.org/{{id}}/white|black"
        )
    return match.group(1), match.group(2)  # group(2) may be None


def fetch_pgn_from_url(url: str) -> tuple[str, str, str | None]:
    """
    Fetch the PGN for a Lichess game URL.

    Returns (pgn_text, lichess_game_id, color_hint).
      pgn_text    — raw PGN string
      lichess_game_id — the 8-char Lichess game ID
      color_hint  — 'white' | 'black' | None  (from URL path segment)

    Raises LichessError on API failures.
    """
    game_id, color_hint = extract_game_id(url)

    endpoint = (
        f"{_EXPORT_BASE}/{game_id}"
        "?clocks=false&evals=false&opening=true&literate=false"
    )

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(
                endpoint,
                headers={
                    "User-Agent": _USER_AGENT,
                    "Accept": "application/x-chess-pgn",
                },
                follow_redirects=True,
            )
    except httpx.RequestError as exc:
        raise LichessError(f"Network error fetching Lichess game: {exc}") from exc

    if r.status_code == 404:
        raise LichessError(
            f"Game {game_id} was not found on Lichess. "
            "The game may be private or the ID may be incorrect."
        )
    if r.status_code != 200:
        raise LichessError(
            f"Lichess API returned {r.status_code} for game {game_id}."
        )

    pgn = r.text.strip()
    if not pgn:
        raise LichessError(f"Lichess returned an empty PGN for game {game_id}.")

    return pgn, game_id, color_hint
