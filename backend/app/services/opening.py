"""
Opening detector.

Builds an EPD → {eco, name} lookup from a curated set of ~220 key opening
lines at import time (takes ~50 ms once; result is cached in the module).

detect_opening(fens) takes the ordered list of EPDs from a game (one per ply)
and returns the most specific (deepest) opening match, or (None, None).

EPD (Extended Position Description) = FEN without the half/full-move clocks,
which makes transpositions collide correctly.
"""

from __future__ import annotations

import chess
from functools import lru_cache

# ---------------------------------------------------------------------------
# Raw opening data
# Format: (eco_code, name, space-separated UCI moves)
# Ordered from shortest to longest so deepest match wins automatically.
# ---------------------------------------------------------------------------

_RAW: list[tuple[str, str, str]] = [
    # ── A: Flank openings ──────────────────────────────────────────────────
    ("A00", "Uncommon Opening",               ""),
    ("A01", "Nimzowitsch-Larsen Attack",       "b2b3"),
    ("A02", "Bird's Opening",                  "f2f4"),
    ("A03", "Bird's Opening, Dutch Variation", "f2f4 d7d5"),
    ("A04", "Réti Opening",                    "g1f3"),
    ("A05", "Réti Opening",                    "g1f3 g8f6"),
    ("A06", "Réti Opening, Old Indian Attack", "g1f3 d7d5"),
    ("A07", "King's Indian Attack",            "g1f3 d7d5 g2g3"),
    ("A08", "King's Indian Attack",            "g1f3 d7d5 g2g3 g8f6 f1g2 g7g6"),
    ("A09", "Réti Gambit",                     "g1f3 d7d5 c2c4"),
    ("A10", "English Opening",                 "c2c4"),
    ("A11", "English, Caro-Kann Defense",      "c2c4 c7c6"),
    ("A12", "English, Caro-Kann, Capablanca",  "c2c4 c7c6 g1f3 d7d5 b2b3"),
    ("A13", "English Opening, Agincourt",      "c2c4 e7e6"),
    ("A15", "English, Anglo-Indian Defense",   "c2c4 g8f6"),
    ("A16", "English Opening",                 "c2c4 g8f6 b1c3"),
    ("A17", "English Opening, Hedgehog",       "c2c4 g8f6 b1c3 e7e6"),
    ("A20", "English Opening, King's English", "c2c4 e7e5"),
    ("A22", "English Opening, King's English", "c2c4 e7e5 b1c3 g8f6"),
    ("A25", "English, Closed, Taimanov",       "c2c4 e7e5 b1c3 b8c6 g2g3"),
    ("A28", "English, Four Knights",           "c2c4 e7e5 b1c3 g8f6 g1f3 b8c6"),
    ("A30", "English, Symmetrical",            "c2c4 c7c5"),
    ("A34", "English, Symmetrical",            "c2c4 c7c5 b1c3 g8f6"),
    ("A40", "Queen's Pawn Game",               "d2d4"),
    ("A41", "Modern Defense, Queen's Pawn",    "d2d4 d7d6"),
    ("A43", "Old Benoni Defense",              "d2d4 c7c5"),
    ("A45", "Indian Defense",                  "d2d4 g8f6"),
    ("A46", "Torre Attack",                    "d2d4 g8f6 g1f3"),
    ("A47", "Queen's Indian Defense",          "d2d4 g8f6 g1f3 b7b6"),
    ("A48", "King's Indian, London System",    "d2d4 g8f6 g1f3 g7g6"),
    ("A50", "Queen's Pawn Game",               "d2d4 g8f6 c2c4"),
    ("A51", "Budapest Gambit",                 "d2d4 g8f6 c2c4 e7e5"),
    ("A52", "Budapest Gambit, Rubinstein Var", "d2d4 g8f6 c2c4 e7e5 d4e5 f6g4"),
    ("A53", "Old Indian Defense",              "d2d4 g8f6 c2c4 d7d6"),
    ("A56", "Benoni Defense",                  "d2d4 g8f6 c2c4 c7c5 d4d5"),
    ("A57", "Benko Gambit",                    "d2d4 g8f6 c2c4 c7c5 d4d5 b7b5"),
    ("A60", "Benoni Defense",                  "d2d4 g8f6 c2c4 c7c5 d4d5 e7e6"),
    ("A80", "Dutch Defense",                   "d2d4 f7f5"),
    ("A81", "Dutch Defense, Leningrad",        "d2d4 f7f5 g2g3"),
    ("A84", "Dutch Defense",                   "d2d4 f7f5 c2c4"),
    ("A85", "Dutch Defense, with c4 & Nc3",   "d2d4 f7f5 c2c4 g8f6 b1c3"),
    ("A90", "Dutch Defense, Classical",        "d2d4 f7f5 c2c4 e7e6 g2g3"),

    # ── B: Semi-open (1.e4, not 1...e5) ───────────────────────────────────
    ("B00", "King's Pawn",                     "e2e4"),
    ("B01", "Scandinavian Defense",            "e2e4 d7d5"),
    ("B01", "Scandinavian, Mieses-Kotroc",     "e2e4 d7d5 e4d5 d8d5"),
    ("B02", "Alekhine Defense",                "e2e4 g8f6"),
    ("B06", "Modern Defense",                  "e2e4 g7g6"),
    ("B07", "Pirc Defense",                    "e2e4 d7d6 d2d4 g8f6"),
    ("B08", "Pirc, Classical",                 "e2e4 d7d6 d2d4 g8f6 b1c3 g7g6"),
    ("B10", "Caro-Kann Defense",               "e2e4 c7c6"),
    ("B12", "Caro-Kann, Advance Variation",    "e2e4 c7c6 d2d4 d7d5 e4e5"),
    ("B13", "Caro-Kann, Exchange Variation",   "e2e4 c7c6 d2d4 d7d5 e4d5"),
    ("B14", "Caro-Kann, Panov-Botvinnik",      "e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4"),
    ("B15", "Caro-Kann Defense",               "e2e4 c7c6 d2d4 d7d5 b1c3"),
    ("B16", "Caro-Kann, Bronstein-Larsen",     "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6"),
    ("B18", "Caro-Kann, Classical",            "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5"),
    ("B19", "Caro-Kann, Classical Main Line",  "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4"),
    ("B20", "Sicilian Defense",                "e2e4 c7c5"),
    ("B21", "Sicilian, Smith-Morra Gambit",    "e2e4 c7c5 d2d4 c5d4 c2c3"),
    ("B22", "Sicilian, Alapin",                "e2e4 c7c5 c2c3"),
    ("B23", "Sicilian, Closed",                "e2e4 c7c5 b1c3"),
    ("B27", "Sicilian, Hungarian",             "e2e4 c7c5 g1f3 g7g6"),
    ("B30", "Sicilian, Nimzowitsch",           "e2e4 c7c5 g1f3 b8c6"),
    ("B32", "Sicilian, Löwenthal",             "e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 e7e5"),
    ("B40", "Sicilian Defense",                "e2e4 c7c5 g1f3 e7e6"),
    ("B44", "Sicilian, Taimanov",              "e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6"),
    ("B50", "Sicilian Defense",                "e2e4 c7c5 g1f3 d7d6"),
    ("B51", "Sicilian, Canal Attack",          "e2e4 c7c5 g1f3 d7d6 c1b5"),
    ("B54", "Sicilian",                        "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4"),
    ("B56", "Sicilian Defense",                "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3"),
    ("B60", "Sicilian, Richter-Rauzer",        "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 b8c6 c1g5"),
    ("B70", "Sicilian, Dragon",                "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6"),
    ("B72", "Sicilian, Dragon, 6.Be3",         "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3"),
    ("B76", "Sicilian, Dragon, Yugoslav",      "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3"),
    ("B78", "Sicilian, Dragon, Yugoslav, 9.Bc4","e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 f1c4"),
    ("B80", "Sicilian, Scheveningen",          "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6"),
    ("B84", "Sicilian, Scheveningen, Classical","e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2"),
    ("B90", "Sicilian, Najdorf",               "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6"),
    ("B91", "Sicilian, Najdorf, Zagreb",       "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2"),
    ("B92", "Sicilian, Najdorf, Opocensky",    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5"),
    ("B96", "Sicilian, Najdorf, Fischer",      "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5"),
    ("B97", "Sicilian, Najdorf, Poisoned Pawn","e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6"),
    ("B99", "Sicilian, Najdorf, 7...Be7",      "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7"),

    # ── C: Open games (1.e4 e5) ────────────────────────────────────────────
    ("C20", "King's Pawn Game",                "e2e4 e7e5"),
    ("C21", "Center Game",                     "e2e4 e7e5 d2d4 e5d4"),
    ("C23", "Bishop's Opening",                "e2e4 e7e5 f1c4"),
    ("C25", "Vienna Game",                     "e2e4 e7e5 b1c3"),
    ("C26", "Vienna, Falkbeer",                "e2e4 e7e5 b1c3 g8f6"),
    ("C27", "Vienna Game, Adams' Gambit",      "e2e4 e7e5 b1c3 g8f6 f1c4 f6e4"),
    ("C30", "King's Gambit",                   "e2e4 e7e5 f2f4"),
    ("C31", "King's Gambit Declined",          "e2e4 e7e5 f2f4 d7d5"),
    ("C33", "King's Gambit Accepted",          "e2e4 e7e5 f2f4 e5f4"),
    ("C34", "King's Gambit, Fischer Defense",  "e2e4 e7e5 f2f4 e5f4 g1f3"),
    ("C41", "Philidor Defense",                "e2e4 e7e5 g1f3 d7d6"),
    ("C42", "Russian Game (Petrov)",           "e2e4 e7e5 g1f3 g8f6"),
    ("C43", "Russian Game, Modern Attack",     "e2e4 e7e5 g1f3 g8f6 d2d4"),
    ("C44", "Ponziani Opening",                "e2e4 e7e5 g1f3 b8c6"),
    ("C45", "Scotch Game",                     "e2e4 e7e5 g1f3 b8c6 d2d4"),
    ("C46", "Three Knights",                   "e2e4 e7e5 g1f3 b8c6 b1c3"),
    ("C47", "Four Knights, Scotch",            "e2e4 e7e5 g1f3 b8c6 b1c3 g8f6"),
    ("C48", "Four Knights, Spanish",           "e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5"),
    ("C50", "Italian Game",                    "e2e4 e7e5 g1f3 b8c6 f1c4"),
    ("C51", "Evans Gambit",                    "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4"),
    ("C53", "Italian, Classical",              "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3"),
    ("C54", "Italian, Giuoco Piano",           "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4"),
    ("C55", "Two Knights Defense",             "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6"),
    ("C56", "Two Knights, Max Lange",          "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e4e5"),
    ("C57", "Two Knights, Fried Liver",        "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 b8a5"),
    ("C58", "Two Knights, 4.Ng5",              "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5"),
    ("C60", "Ruy Lopez (Spanish)",             "e2e4 e7e5 g1f3 b8c6 f1b5"),
    ("C61", "Ruy Lopez, Bird's Defense",       "e2e4 e7e5 g1f3 b8c6 f1b5 b8d4"),
    ("C63", "Ruy Lopez, Schliemann",           "e2e4 e7e5 g1f3 b8c6 f1b5 f7f5"),
    ("C65", "Ruy Lopez, Berlin Defense",       "e2e4 e7e5 g1f3 b8c6 f1b5 g8f6"),
    ("C67", "Ruy Lopez, Berlin, Rio Gambit",   "e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d1e1"),
    ("C68", "Ruy Lopez, Exchange",             "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6"),
    ("C70", "Ruy Lopez, Morphy Defense",       "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6"),
    ("C71", "Ruy Lopez, Modern Steinitz",      "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6"),
    ("C72", "Ruy Lopez, Modern Steinitz",      "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6 e1g1"),
    ("C77", "Ruy Lopez, Morphy Defense",       "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6"),
    ("C78", "Ruy Lopez, Moller Defense",       "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1"),
    ("C80", "Ruy Lopez, Open",                 "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4"),
    ("C84", "Ruy Lopez, Closed",               "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7"),
    ("C85", "Ruy Lopez, Exchange, Improved",   "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1"),
    ("C88", "Ruy Lopez, Closed, 7...0-0",      "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 h1e1 b7b5 a4b3 e8g8"),
    ("C89", "Ruy Lopez, Marshall Attack",      "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 h1e1 b7b5 a4b3 e8g8 c2c3 d7d5"),
    ("C92", "Ruy Lopez, Closed, 9.h3",         "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 h1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3"),

    # ── C: French Defense ──────────────────────────────────────────────────
    ("C00", "French Defense",                  "e2e4 e7e6"),
    ("C01", "French, Exchange",                "e2e4 e7e6 d2d4 d7d5 e4d5"),
    ("C02", "French, Advance",                 "e2e4 e7e6 d2d4 d7d5 e4e5"),
    ("C03", "French, Tarrasch",                "e2e4 e7e6 d2d4 d7d5 b1d2"),
    ("C06", "French, Tarrasch, Closed",        "e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6"),
    ("C10", "French, Rubinstein",              "e2e4 e7e6 d2d4 d7d5 b1c3"),
    ("C11", "French, Classical",               "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6"),
    ("C12", "French, MacCutcheon",             "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8b4"),
    ("C13", "French, Classical",               "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 d5e4"),
    ("C14", "French, Classical",               "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7"),
    ("C15", "French, Winawer",                 "e2e4 e7e6 d2d4 d7d5 b1c3 f8b4"),
    ("C17", "French, Winawer, Advance",        "e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5"),
    ("C18", "French, Winawer, Advance, 6.a3",  "e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3"),
    ("C19", "French, Winawer, Advance, 7.Ne2", "e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7"),

    # ── D: Closed games (1.d4 d5) ──────────────────────────────────────────
    ("D00", "Queen's Pawn Game",               "d2d4 d7d5"),
    ("D01", "Richter-Veresov Attack",          "d2d4 d7d5 b1c3 g8f6 c1g5"),
    ("D02", "Queen's Pawn, London System",     "d2d4 d7d5 g1f3 g8f6 c1f4"),
    ("D04", "Queen's Pawn, Colle System",      "d2d4 d7d5 g1f3 g8f6 e2e3"),
    ("D06", "Queen's Gambit",                  "d2d4 d7d5 c2c4"),
    ("D07", "Queen's Gambit, Chigorin",        "d2d4 d7d5 c2c4 b8c6"),
    ("D08", "Albin Counter-Gambit",            "d2d4 d7d5 c2c4 e7e5"),
    ("D10", "Queen's Gambit, Slav Defense",    "d2d4 d7d5 c2c4 c7c6"),
    ("D11", "Slav Defense",                    "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6"),
    ("D12", "Slav Defense, Exchange",          "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6 e2e3 c8f5"),
    ("D15", "Slav Defense",                    "d2d4 d7d5 c2c4 c7c6 b1c3 g8f6"),
    ("D17", "Slav Defense, Czech",             "d2d4 d7d5 c2c4 c7c6 b1c3 g8f6 g1f3 d5c4 a2a4 c8f5"),
    ("D18", "Slav Defense, Dutch",             "d2d4 d7d5 c2c4 c7c6 b1c3 g8f6 g1f3 d5c4 a2a4 c8f5 e2e3 e7e6"),
    ("D20", "Queen's Gambit Accepted",         "d2d4 d7d5 c2c4 d5c4"),
    ("D26", "QGA, Classical",                  "d2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6"),
    ("D30", "Queen's Gambit Declined",         "d2d4 d7d5 c2c4 e7e6"),
    ("D31", "Queen's Gambit Declined",         "d2d4 d7d5 c2c4 e7e6 b1c3"),
    ("D35", "QGD, Exchange",                   "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c4d5"),
    ("D37", "QGD, 4.Nf3",                      "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3"),
    ("D38", "QGD, Ragozin",                    "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8b4"),
    ("D40", "QGD, Semi-Tarrasch",              "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c5"),
    ("D43", "QGD, Semi-Slav",                  "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c6"),
    ("D44", "QGD, Semi-Slav, Anti-Moscow",     "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c6 c1g5"),
    ("D45", "QGD, Semi-Slav, Stoltz",          "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c6 e2e3"),
    ("D46", "QGD, Semi-Slav, Meran",           "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c6 e2e3 b8d7"),
    ("D50", "QGD, 4.Bg5",                      "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5"),
    ("D52", "QGD, Cambridge Springs",          "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 b8d7 e2e3 c7c6"),
    ("D55", "QGD, 6.Nf3",                      "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3"),
    ("D56", "QGD, Lasker Defense",             "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 f6e4"),
    ("D58", "QGD, Tartakower",                 "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 c1h4 b7b6"),
    ("D70", "Grünfeld Defense",                "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5"),
    ("D80", "Grünfeld, Russian System",        "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3"),
    ("D85", "Grünfeld, Exchange",              "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3"),
    ("D97", "Grünfeld, Russian Variation",     "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3"),

    # ── E: Indian Defenses ─────────────────────────────────────────────────
    ("E00", "Catalan Opening",                 "d2d4 g8f6 c2c4 e7e6 g2g3"),
    ("E06", "Catalan, Closed",                 "d2d4 g8f6 c2c4 e7e6 g2g3 d7d5 g1f3 f8e7 f1g2 e8g8"),
    ("E10", "Queen's Pawn, Blumenfeld",        "d2d4 g8f6 c2c4 e7e6 g1f3"),
    ("E11", "Bogo-Indian Defense",             "d2d4 g8f6 c2c4 e7e6 g1f3 f8b4"),
    ("E12", "Queen's Indian Defense",          "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6"),
    ("E15", "Queen's Indian, Nimzowitsch",     "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3"),
    ("E17", "Queen's Indian, 5.B3",            "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7"),
    ("E20", "Nimzo-Indian Defense",            "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4"),
    ("E21", "Nimzo-Indian, Three Knights",     "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 g1f3"),
    ("E24", "Nimzo-Indian, Sämisch",           "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3"),
    ("E32", "Nimzo-Indian, Classical",         "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2"),
    ("E40", "Nimzo-Indian, 4.e3",              "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3"),
    ("E46", "Nimzo-Indian, Reshevsky",         "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8"),
    ("E60", "King's Indian Defense",           "d2d4 g8f6 c2c4 g7g6"),
    ("E61", "King's Indian Defense",           "d2d4 g8f6 c2c4 g7g6 b1c3"),
    ("E62", "King's Indian, Fianchetto",       "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 g1f3 e8g8 g2g3"),
    ("E70", "King's Indian, Averbakh",         "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4"),
    ("E72", "King's Indian, Averbakh, 6.Be3",  "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 c1e3"),
    ("E76", "King's Indian, Four Pawns Attack","d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f4"),
    ("E80", "King's Indian, Sämisch",          "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3"),
    ("E84", "King's Indian, Sämisch, Panno",   "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 b8c6"),
    ("E90", "King's Indian, 5.Nf3",            "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3"),
    ("E91", "King's Indian, 6.Be2",            "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2"),
    ("E92", "King's Indian, Classical",        "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5"),
    ("E94", "King's Indian, Orthodox",         "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1"),
    ("E97", "King's Indian, Orthodox, Bayonet","d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5"),
    ("E99", "King's Indian, Orthodox, Main",   "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6e8 f2f3 f7f5"),
]


# ---------------------------------------------------------------------------
# Build EPD lookup at import time
# ---------------------------------------------------------------------------

def _build_lookup() -> dict[str, tuple[str, str]]:
    """
    Replay each opening's UCI moves, compute the resulting EPD, and store
    eco→name in a dict keyed by EPD string.

    When two openings share the same EPD (rare but possible with duplicate
    entries), the later (longer/more specific) entry wins.
    """
    lookup: dict[str, tuple[str, str]] = {}
    for eco, name, uci_str in _RAW:
        board = chess.Board()
        try:
            moves = uci_str.split() if uci_str.strip() else []
            for uci in moves:
                board.push_uci(uci)
            epd = board.epd()
            lookup[epd] = (eco, name)
        except Exception:
            pass  # skip malformed entries silently
    return lookup


# Module-level singleton — built once on first import
_EPD_LOOKUP: dict[str, tuple[str, str]] = _build_lookup()

# ---------------------------------------------------------------------------
# Gambit metadata
# ---------------------------------------------------------------------------

# ECO code → which color PLAYS (initiates) the gambit
_GAMBIT_PLAYER: dict[str, str] = {
    "A09": "white",   # Réti Gambit
    "A51": "black",   # Budapest Gambit
    "A52": "black",   # Budapest Gambit, Rubinstein
    "A57": "black",   # Benko Gambit
    "B21": "white",   # Sicilian, Smith-Morra Gambit
    "C27": "white",   # Vienna Game, Adams' Gambit
    "C30": "white",   # King's Gambit
    "C31": "white",   # King's Gambit Declined
    "C33": "white",   # King's Gambit Accepted
    "C34": "white",   # King's Gambit Accepted, Fischer Def
    "C51": "white",   # Evans Gambit
    "C56": "white",   # Two Knights, Max Lange Attack
    "C57": "white",   # Two Knights, Fried Liver Attack
    "C67": "white",   # Ruy Lopez, Rio Gambit
    "C89": "black",   # Ruy Lopez, Marshall Attack (Black gambits)
    "D06": "white",   # Queen's Gambit
    "D07": "white",   # Queen's Gambit, Chigorin
    "D08": "black",   # Albin Counter-Gambit
    "D20": "white",   # Queen's Gambit Accepted
    "D26": "white",   # QGA, Classical
}


def get_gambit_info(
    eco_code: str | None,
    opening_name: str | None,
) -> tuple[bool, str | None]:
    """
    Return (is_gambit, gambit_player_color).

    is_gambit      — True when the opening is a gambit (name contains "Gambit"
                     or ECO code is in the explicit lookup).
    gambit_player_color — "white" | "black" | None (unknown)
    """
    name_is_gambit = bool(opening_name and "gambit" in opening_name.lower())
    eco_player = _GAMBIT_PLAYER.get(eco_code or "")
    is_gambit = name_is_gambit or bool(eco_player)

    if not is_gambit:
        return False, None

    return True, eco_player  # may be None for name-matched gambits we don't have a color for


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_opening(fens: list[str]) -> tuple[str | None, str | None]:
    """
    Walk the game's FEN list and return the (eco_code, name) of the deepest
    (most specific) opening position found.

    *fens* should be the ordered list of FEN strings — one per ply, starting
    with the position AFTER each move (fen_after from the pipeline).
    The starting position is checked implicitly.

    Returns (None, None) if no opening is found.
    """
    eco: str | None = None
    name: str | None = None

    # Always check the start position
    start_epd = chess.Board().epd()
    if start_epd in _EPD_LOOKUP:
        eco, name = _EPD_LOOKUP[start_epd]

    for fen in fens:
        # Normalise: strip move counters to get EPD
        epd = _fen_to_epd(fen)
        if epd in _EPD_LOOKUP:
            eco, name = _EPD_LOOKUP[epd]
        # Stop searching once we're past the opening (move 25+)
        # to avoid false matches in transpositions deep in the middlegame.
        # The FEN fullmove counter is the 6th field.
        try:
            full_move = int(fen.split()[5])
            if full_move > 25:
                break
        except (IndexError, ValueError):
            pass

    return eco, name


def _fen_to_epd(fen: str) -> str:
    """Return the EPD part of a FEN (first 4 space-separated fields)."""
    return " ".join(fen.split()[:4])
