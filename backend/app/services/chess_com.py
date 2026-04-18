"""
Chess.com Public API client.

Responsibilities:
- Fetch PGN from a Chess.com game URL
- Parse the game ID from a Chess.com URL
- Handle rate limiting and fallback strategies

Chess.com URL formats:
  https://www.chess.com/game/live/96789456789
  https://www.chess.com/game/daily/12345678

Strategy for fetching PGN:
  1. Try the undocumented GET /pub/game/{id} endpoint (fast, usually 404s)
  2. Fall back to /callback/live/game/{id} to get player username + UUID
  3. Parse the UUID v1 timestamp to determine year/month
  4. Fetch the documented /pub/player/{username}/games/{YYYY}/{MM} archive
  5. Find the game by matching the URL and return its PGN
"""

from __future__ import annotations

import datetime
import re
import uuid as uuid_lib

import httpx

from app.config import settings

_USER_AGENT = "SochMate/0.1 (chess analysis tool; contact@sochmate.app)"

_GAME_URL_RE = re.compile(
    r"chess\.com/game/(live|daily)/(\d+)",
    re.IGNORECASE,
)

_RETRY_DELAYS = [1.0, 2.0, 4.0]


class ChessComError(Exception):
    """Raised when the Chess.com API returns an error or unexpected response."""


def is_chess_com_url(text: str) -> bool:
    """
    Returns True only when the *entire* input is a Chess.com game URL.
    We check for the absence of newlines so that a PGN containing a
    [Link "https://www.chess.com/..."] header is NOT matched.
    """
    stripped = text.strip()
    return "\n" not in stripped and bool(_GAME_URL_RE.search(stripped))


def extract_game_id(url: str) -> tuple[str, str]:
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
    """
    game_type, game_id = extract_game_id(url)

    # Strategy 1: undocumented direct endpoint (fast, but often 404s)
    pgn = _try_direct_endpoint(game_id)
    if pgn:
        return pgn, game_id

    # Strategy 2: callback endpoint → monthly archive lookup
    pgn = _fetch_via_monthly_archive(game_id)
    if pgn:
        return pgn, game_id

    raise ChessComError(
        f"Could not retrieve game {game_id} from Chess.com. "
        "The game may be private. Please paste the PGN directly."
    )


# ---------------------------------------------------------------------------
# Strategy 1: undocumented /pub/game/{id}
# ---------------------------------------------------------------------------

def _try_direct_endpoint(game_id: str) -> str | None:
    """
    Try GET /pub/game/{id}. Returns PGN string or None if unavailable.
    Does not raise — failures just return None to trigger the fallback.
    """
    endpoint = f"{settings.chess_com_api_base}/game/{game_id}"
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(endpoint, headers={"User-Agent": _USER_AGENT})
        if r.status_code == 200:
            return r.json().get("pgn") or None
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Strategy 2: callback endpoint + monthly archive
# ---------------------------------------------------------------------------

def _fetch_via_monthly_archive(game_id: str) -> str | None:
    """
    1. Hit /callback/live/game/{id} to get username + UUID.
    2. Decode the UUID v1 timestamp to get year/month.
    3. Fetch /pub/player/{username}/games/{YYYY}/{MM}.
    4. Find the game by URL and return its PGN.
    """
    # Step 1: get player info + UUID from the callback endpoint
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(
                f"https://www.chess.com/callback/live/game/{game_id}",
                headers={"User-Agent": _USER_AGENT},
            )
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None

    # Extract username (try both top/bottom player slots)
    players = data.get("players", {})
    username = (
        players.get("top", {}).get("username")
        or players.get("bottom", {}).get("username")
    )
    raw_uuid = data.get("game", {}).get("uuid")

    if not username or not raw_uuid:
        return None

    # Step 2: decode UUID v1 timestamp → year/month
    year, month = _year_month_from_uuid(raw_uuid)
    if not year:
        return None

    # Step 3: fetch monthly archive — retry the current month and one month back
    # (in case the game was played near a month boundary)
    for yr, mo in _month_range(year, month, lookback=1):
        pgn = _find_game_in_archive(username, yr, mo, game_id)
        if pgn:
            return pgn

    return None


def _year_month_from_uuid(raw_uuid: str) -> tuple[int | None, int | None]:
    """Parse a UUID v1 timestamp and return (year, month)."""
    try:
        u = uuid_lib.UUID(raw_uuid)
        if u.version != 1:
            return None, None
        # UUID v1 timestamp: 100-ns intervals since 15 Oct 1582
        ts_seconds = (u.time - 0x01b21dd213814000) * 100 / 1e9
        dt = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(seconds=ts_seconds)
        return dt.year, dt.month
    except Exception:
        return None, None


def _month_range(year: int, month: int, lookback: int):
    """Yield (year, month) tuples starting from the given month going back `lookback` months."""
    for i in range(lookback + 1):
        mo = month - i
        yr = year
        if mo < 1:
            mo += 12
            yr -= 1
        yield yr, mo


def _find_game_in_archive(username: str, year: int, month: int, game_id: str) -> str | None:
    """Fetch the monthly archive and return the PGN for the matching game ID."""
    endpoint = f"{settings.chess_com_api_base}/player/{username}/games/{year}/{month:02d}"
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            r = client.get(endpoint, headers={"User-Agent": _USER_AGENT})
        if r.status_code != 200:
            return None
        games = r.json().get("games", [])
    except Exception:
        return None

    for game in games:
        if game_id in game.get("url", ""):
            return game.get("pgn") or None

    return None


# ---------------------------------------------------------------------------
# Bulk import helpers
# ---------------------------------------------------------------------------

def fetch_archives(username: str) -> list[str]:
    """
    Return the list of monthly archive URLs for a player, newest first.
    Raises ChessComError if the username is not found or the API fails.
    """
    endpoint = f"{settings.chess_com_api_base}/player/{username}/games/archives"
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(endpoint, headers={"User-Agent": _USER_AGENT})
    except httpx.RequestError as exc:
        raise ChessComError(f"Network error reaching Chess.com: {exc}") from exc

    if r.status_code == 404:
        raise ChessComError(
            f"Player '{username}' not found on Chess.com. "
            "Check the spelling — usernames are case-insensitive."
        )
    if r.status_code != 200:
        raise ChessComError(f"Chess.com API returned {r.status_code} for player '{username}'.")

    archives = r.json().get("archives", [])
    return list(reversed(archives))   # newest month first


def fetch_archive_games(archive_url: str) -> list[dict]:
    """
    Fetch raw game dicts from a monthly archive URL.
    Returns an empty list on any failure (best-effort).
    Each dict contains at minimum: url, pgn, white{username,rating}, black{username,rating}.
    """
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            r = client.get(archive_url, headers={"User-Agent": _USER_AGENT})
        if r.status_code != 200:
            return []
        return r.json().get("games", [])
    except Exception:
        return []
