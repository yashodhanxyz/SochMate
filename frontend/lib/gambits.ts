/**
 * Gambit library — theory and practice lines for common gambits.
 *
 * moves_uci: the full main-line sequence to practice.
 * player_color: which side the student plays.
 * Moves at even indices (0,2,4…) are White's; odd indices are Black's.
 */

export interface GambitData {
  id: string;
  eco: string;
  name: string;
  player_color: "white" | "black";
  tagline: string;
  theory: string;
  key_ideas: string[];
  moves_uci: string[];
}

export const GAMBITS: GambitData[] = [
  // ──────────────────────────────────────────────
  // WHITE GAMBITS
  // ──────────────────────────────────────────────
  {
    id: "kings-gambit",
    eco: "C33",
    name: "King's Gambit",
    player_color: "white",
    tagline: "The most swashbuckling opening in chess",
    theory:
      "White sacrifices the f-pawn on move 2 to blow open the center and seize rapid " +
      "development. The f-file becomes a future weapon for the rook, and Black must " +
      "survive a storm of tactics before consolidating. Beloved by Morphy, Spassky, and " +
      "every romantic attacker who ever sat at a board.",
    key_ideas: [
      "Play f4 early to challenge Black's e5 pawn and open the f-file",
      "Develop rapidly: Nf3, Bc4 — aim pieces at f7",
      "Push d4 to control the center after Black accepts",
      "Use the open f-file with Rf1 after castling to pressure f7",
    ],
    // 1.e4 e5 2.f4 exf4 3.Nf3 d6 4.d4 g5 5.h4 g4 6.Ng5
    moves_uci: ["e2e4", "e7e5", "f2f4", "e5f4", "g1f3", "d7d6", "d2d4", "g7g5", "h2h4", "g5g4", "f3g5"],
  },
  {
    id: "evans-gambit",
    eco: "C51",
    name: "Evans Gambit",
    player_color: "white",
    tagline: "A pawn sacrifice that turns the Italian into a fireball",
    theory:
      "After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5, White plays the stunning 4.b4! — offering a " +
      "pawn to deflect Black's bishop and immediately launch a d4 center. The Evans " +
      "Gambit transforms the quiet Giuoco Piano into one of the sharpest openings on the " +
      "board. Anderssen used it to demolish top players; Kasparov revived it against " +
      "Anand in 1995.",
    key_ideas: [
      "Play b4! to chase Black's bishop off the c5 diagonal",
      "Follow with c3 and d4 to build a massive pawn center",
      "Develop Nc3, and aim the Bc4 at f7",
      "Castle quickly and use your extra space to attack",
    ],
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Bc5 6.d4 exd4 7.cxd4 Bb6
    moves_uci: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "b2b4", "c5b4", "c2c3", "b4c5", "d2d4", "e5d4", "c3d4", "c5b6"],
  },
  {
    id: "smith-morra",
    eco: "B21",
    name: "Smith-Morra Gambit",
    player_color: "white",
    tagline: "Two pawns for a tornado of development against the Sicilian",
    theory:
      "Instead of playing the standard Open Sicilian, White offers a pawn (and often two!) " +
      "after 1.e4 c5 2.d4 cxd4 3.c3. Black must decide whether to accept and weather a " +
      "fierce developmental attack, or decline and face a solid center. White gets rapid " +
      "development, an open c-file, and dangerous kingside pressure in exchange for the pawn.",
    key_ideas: [
      "Play d4 and c3 to offer the gambit — aim for a huge development lead",
      "After dxc3 Nxc3: get Nf3, Bc4 and castle as fast as possible",
      "Use the open c-file — Rc1 puts immediate pressure on c6 and c7",
      "The knight on c3 and bishop on c4 create classic attacking formation",
    ],
    // 1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3 Nc6 5.Nf3 d6 6.Bc4 e6 7.O-O
    moves_uci: ["e2e4", "c7c5", "d2d4", "c5d4", "c2c3", "d4c3", "b1c3", "b8c6", "g1f3", "d7d6", "f1c4", "e7e6", "e1g1"],
  },
  {
    id: "fried-liver",
    eco: "C57",
    name: "Fried Liver Attack",
    player_color: "white",
    tagline: "A knight sacrifice that has shocked players for 500 years",
    theory:
      "After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5, White plays the " +
      "spectacular 6.Nxf7!! — sacrificing a knight to drag the Black king into the open. " +
      "This attack was known in the 15th century and still causes havoc today. " +
      "Black's king is exposed to a ferocious assault — Qf3+ and Nc3 quickly join the attack.",
    key_ideas: [
      "Set up with Ng5 after d5 — force ...Nxd5",
      "Play Nxf7!! sacrificing the knight to open the king",
      "After Kxf7, follow with Qf3+ to force the king further out",
      "Bring Nc3 to d5 — every piece joins the hunt on the exposed king",
    ],
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5 6.Nxf7! Kxf7 7.Qf3+
    moves_uci: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "f3g5", "d7d5", "e4d5", "f6d5", "g5f7", "e8f7", "d1f3"],
  },
  {
    id: "queens-gambit",
    eco: "D06",
    name: "Queen's Gambit",
    player_color: "white",
    tagline: "The most popular gambit in history — and barely even a gambit",
    theory:
      "After 1.d4 d5 2.c4, White offers the c-pawn. If Black takes, White regains it " +
      "easily with Nc3 and e4 while gaining a dominant center. If Black declines, White " +
      "has the better center anyway. The Queen's Gambit is actually a misnomer — White " +
      "almost always gets the pawn back — but it remains the most classical and " +
      "strategically rich opening in chess.",
    key_ideas: [
      "Offer c4 to fight for the center — you can always recapture it",
      "Develop Nc3, Nf3 and get the pieces active quickly",
      "Aim for the ideal center with e4 after Nc3 and Nf3",
      "Use Bg5 or Bf4 to pin/pressure Black's pieces",
    ],
    // 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4
    moves_uci: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c1g5", "f8e7", "e2e3", "e8g8", "g1f3", "h7h6", "g5h4"],
  },

  // ──────────────────────────────────────────────
  // BLACK GAMBITS
  // ──────────────────────────────────────────────
  {
    id: "budapest-gambit",
    eco: "A51",
    name: "Budapest Gambit",
    player_color: "black",
    tagline: "Black counter-attacks immediately with a shocking pawn sacrifice",
    theory:
      "After 1.d4 Nf6 2.c4, instead of the normal Indian defenses, Black strikes " +
      "immediately with 2...e5! — sacrificing a pawn to disrupt White's plans and seize " +
      "activity. White often ends up with an awkward, passive position while Black's pieces " +
      "roam freely. A great weapon at club level where opponents are unprepared.",
    key_ideas: [
      "Play e5! immediately after c4 — surprise and disrupt White's center",
      "After dxe5 Ng4, aim to regain the pawn with Nxe5",
      "Use the piece activity to compensate for the pawn deficit",
      "Get Nc6, Bc5 and castle quickly to stay active",
    ],
    // 1.d4 Nf6 2.c4 e5 3.dxe5 Ng4 4.Nf3 Nxe5 5.Nxe5 — wait, that's wrong
    // Actually: 3.dxe5 Ng4 4.Bf4 Nc6 5.Nf3 Bb4+ 6.Nbd2 Qe7
    moves_uci: ["d2d4", "g8f6", "c2c4", "e7e5", "d4e5", "f6g4", "c1f4", "b8c6", "g1f3", "f8b4", "b1d2", "d8e7"],
  },
  {
    id: "benko-gambit",
    eco: "A57",
    name: "Benko Gambit",
    player_color: "black",
    tagline: "A queenside pawn sacrifice for long-term pressure",
    theory:
      "After 1.d4 Nf6 2.c4 c5 3.d5 b5!, Black sacrifices a queenside pawn to blow open " +
      "the a and b files for long-term pressure. White gets an extra pawn but Black gets " +
      "a positional bind — the a-file, b-file, and g7 bishop create relentless queenside " +
      "pressure. Many grandmasters have used it as their main weapon against 1.d4.",
    key_ideas: [
      "Play b5! to sacrifice the pawn and open the a and b files",
      "After cxb5 a6 bxa6, use Bxa6 to recapture and activate the bishop",
      "Fianchetto the g7 bishop — it becomes a long-range sniper on the long diagonal",
      "Keep the queenside pressure with Rb8 and Nc6 — the compensation lasts forever",
    ],
    // 1.d4 Nf6 2.c4 c5 3.d5 b5 4.cxb5 a6 5.bxa6 Bxa6 6.Nc3 g6 7.Nf3 Bg7
    moves_uci: ["d2d4", "g8f6", "c2c4", "c7c5", "d4d5", "b7b5", "c4b5", "a7a6", "b5a6", "c8a6", "b1c3", "g7g6", "g1f3", "f8g7"],
  },
  {
    id: "albin-counter",
    eco: "D08",
    name: "Albin Counter-Gambit",
    player_color: "black",
    tagline: "Black strikes back in the center before White gets comfortable",
    theory:
      "After 1.d4 d5 2.c4, instead of declining or accepting the Queen's Gambit, Black " +
      "plays 2...e5!? — a sharp counter-gambit. After 3.dxe5 d4!, the d-pawn becomes a " +
      "dangerous passed pawn that restricts White's pieces. Black gets active play and " +
      "tactical complications that catch many unprepared White players off guard.",
    key_ideas: [
      "Play e5! on move 2 to immediately challenge the center",
      "After dxe5, push d4! — this pawn becomes a long-term bind",
      "Develop Nc6, Nge7 and Ng6 to support the d-pawn",
      "Don't rush — the d-pawn is your long-term trump card",
    ],
    // 1.d4 d5 2.c4 e5 3.dxe5 d4 4.Nf3 Nc6 5.g3 Be6 6.Bg2 Qd7
    moves_uci: ["d2d4", "d7d5", "c2c4", "e7e5", "d4e5", "d5d4", "g1f3", "b8c6", "g2g3", "c8e6", "f1g2", "d8d7"],
  },
  {
    id: "marshall-attack",
    eco: "C89",
    name: "Marshall Attack",
    player_color: "black",
    tagline: "Black's most famous pawn sacrifice in the Ruy Lopez",
    theory:
      "After the standard Ruy Lopez moves 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O " +
      "Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5!!, Black sacrifices a pawn for a ferocious kingside " +
      "attack. This gambit, introduced by Frank Marshall in 1918, is so dangerous that " +
      "many strong players avoid it with the Anti-Marshall (8.a4). The attack features " +
      "piece sacrifices and direct assaults on the White king.",
    key_ideas: [
      "Play d5!! to sacrifice a pawn and open the center immediately",
      "After exd5 Nxd5 Nxe5 Nxe5 Rxe5, follow with c6 — don't take on f2 yet",
      "Use Bd6 and Qh4 to set up a direct kingside attack",
      "The key is coordinating Nf4, Bg4 and the queen for a mating attack",
    ],
    // The Marshall starts from the full Ruy Lopez setup
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5!
    moves_uci: [
      "e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6",
      "b5a4", "g8f6", "e1g1", "f8e7", "h1e1", "b7b5",
      "a4b3", "e8g8", "c2c3", "d7d5",
    ],
  },
];
