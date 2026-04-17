# SochMate

A chess improvement tool that analyzes your games move by move using the Stockfish engine, classifies every move, and tells you where you went wrong and why.

**"Soch"** (सोच) is the Hindi/Urdu word for *thought* or *thinking*. The name reflects the goal: help you think better at chess.

---

## What it does

You paste a Chess.com game link or raw PGN. SochMate:

1. Parses the PGN and reconstructs every position
2. Runs Stockfish on each position before and after the move to get the centipawn evaluation
3. Calculates how much each move changed the evaluation (the "centipawn loss")
4. Classifies every move — **Best, Excellent, Good, Inaccuracy, Mistake, Blunder**
5. Generates a short explanation for each classification
6. Computes an accuracy score for both players (same formula Chess.com uses)
7. Identifies the critical moment — the single move with the biggest evaluation swing
8. Stores everything to your account so you can review your games over time

---

## Tech stack

### Backend — Python

| Library | Version | Purpose |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com) | 0.111 | Async REST API |
| [SQLAlchemy](https://sqlalchemy.org) | 2.0 | ORM (async via asyncpg) |
| [Alembic](https://alembic.sqlalchemy.org) | 1.13 | Database migrations |
| [asyncpg](https://github.com/MagicStack/asyncpg) | 0.29 | Async PostgreSQL driver |
| [psycopg2-binary](https://www.psycopg.org) | 2.9 | Sync PostgreSQL driver (Celery workers) |
| [Celery](https://docs.celeryq.dev) | 5.4 | Async task queue for Stockfish analysis |
| [Redis](https://redis.io) | — | Celery broker + result backend |
| [python-chess](https://python-chess.readthedocs.io) | 1.10 | PGN parsing, board reconstruction, Stockfish interface |
| [httpx](https://www.python-httpx.org) | 0.27 | HTTP client for Chess.com API |
| [PyJWT](https://pyjwt.readthedocs.io) | 2.8 | JWT creation and verification |
| [bcrypt](https://pypi.org/project/bcrypt) | 5.0 | Password hashing |
| [google-auth](https://google-auth.readthedocs.io) | 2.29 | Google OAuth id_token verification |
| [pydantic](https://docs.pydantic.dev) | 2.7 | Request/response validation |
| [Stockfish](https://stockfishchess.org) | 16/18 | Chess engine (system binary, not a Python package) |

### Frontend — TypeScript

| Library | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org) | 16.2 | React framework (App Router) |
| [React](https://react.dev) | 19 | UI |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Styling (CSS-based config, no `tailwind.config.ts`) |
| [react-chessboard](https://github.com/Clariity/react-chessboard) | 5.10 | Interactive chess board component |
| [chess.js](https://github.com/jhlywa/chess.js) | 1.4 | Move validation and FEN manipulation in the browser |
| [@react-oauth/google](https://github.com/MomenSherif/react-oauth) | 0.13 | Google Identity Services wrapper |

### Infrastructure

| Tool | Purpose |
|---|---|
| PostgreSQL 16 | Primary database |
| Redis | Celery message broker and result backend |
| Docker Compose | Local development orchestration |
| [Railway](https://railway.app) | Backend deployment target |
| [Vercel](https://vercel.com) | Frontend deployment target |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  Next.js (App Router)                                   │
│  • /                  — paste PGN or Chess.com URL      │
│  • /analyze/[gameId]  — move-by-move analysis view      │
│  • /games             — your game history               │
│  • /login  /register  — auth (email + Google OAuth)     │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP  (Authorization: Bearer JWT)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  FastAPI  (uvicorn)                                     │
│                                                         │
│  POST /api/auth/register                                │
│  POST /api/auth/login                                   │
│  POST /api/auth/google   ← verifies Google id_token     │
│  GET  /api/auth/me                                      │
│                                                         │
│  POST /api/games         ← parse PGN, enqueue task      │
│  GET  /api/games/{id}                                   │
│  GET  /api/games/{id}/status                            │
│  GET  /api/users/me/games                               │
└─────────────┬───────────────────────┬───────────────────┘
              │ asyncpg               │ Celery task
              ▼                       ▼
┌─────────────────────┐   ┌───────────────────────────────┐
│  PostgreSQL          │   │  Celery Worker                │
│                     │   │                               │
│  users              │   │  analyze_game(game_id)        │
│  games              │   │  1. parse PGN                 │
│  moves              │◄──│  2. evaluate each position    │
│  game_summaries     │   │     (Stockfish via            │
│                     │   │      python-chess UCI)        │
└─────────────────────┘   │  3. classify each move        │
                          │  4. generate explanation      │
                          │  5. compute game summary      │
              ┌───────────│  6. persist to PostgreSQL     │
              │           └───────────────────────────────┘
              ▼
┌─────────────────────┐
│  Redis               │
│  • Celery broker     │
│  • Result backend    │
└─────────────────────┘
```

### Analysis pipeline (the interesting part)

Every submitted game goes through this synchronous pipeline inside a Celery worker:

```
PGN text
  └─ pgn_parser.py     → ParsedGame (plies with FEN before/after)
       └─ engine.py    → PositionEval (cp, mate, best_move_uci) × 2 per ply
            └─ classifier.py  → MoveClassification + eval_delta_cp
                 └─ explainer.py    → one-sentence explanation
                      └─ summarizer.py → accuracy %, blunder/mistake counts, critical moment
                           └─ tasks/analysis.py → persists everything in one DB transaction
```

**Move classification thresholds** (centipawn loss from the moving player's perspective):

| Classification | Threshold |
|---|---|
| Best | ≤ 5 cp |
| Excellent | ≤ 20 cp |
| Good | ≤ 50 cp |
| Inaccuracy | ≤ 100 cp |
| Mistake | ≤ 200 cp |
| Blunder | > 200 cp |

Thresholds are doubled when the position is already losing (< −300 cp from the player's perspective), to avoid over-penalizing moves in resignable positions.

**Accuracy formula** — same as Chess.com:
```
win_pct(cp) = 50 + 50 × (2 / (1 + exp(−0.00368208 × cp)) − 1)
move_accuracy = max(0, 103.1668 × exp(−0.04354 × Δwin_pct) − 3.1669)
game_accuracy = mean(move_accuracy) over all moves
```

**Eval perspective**: Stockfish always returns evaluations from White's absolute perspective (positive = White better). The classifier converts to the moving player's perspective using `sign = 1 if color == "white" else −1`.

**Mate scores**: Stored separately as `eval_before_mate` / `eval_after_mate`. A sentinel of `±10,000 cp` is used for delta calculations when transitioning between cp and mate scores.

**Stockfish concurrency**: The engine is not thread-safe. Each Celery worker process gets its own singleton Stockfish instance (module-level, initialized once, registered with `atexit` for cleanup). Workers must run with `--concurrency=N` where N = number of processes, not threads.

---

## Project structure

```
SochMate/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py         # register, login, google, /me
│   │   │   ├── deps.py         # get_current_user FastAPI dependency
│   │   │   ├── games.py        # submit + retrieve games
│   │   │   └── users.py        # game history
│   │   ├── models/
│   │   │   ├── user.py         # User ORM model
│   │   │   ├── game.py         # Game ORM model
│   │   │   ├── move.py         # Move ORM model (one row per ply)
│   │   │   └── game_summary.py # GameSummary ORM model
│   │   ├── schemas/
│   │   │   └── game.py         # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── auth.py         # bcrypt hashing + JWT sign/verify
│   │   │   ├── chess_com.py    # Chess.com API fetcher with retry
│   │   │   ├── classifier.py   # centipawn loss → classification
│   │   │   ├── engine.py       # Stockfish singleton wrapper
│   │   │   ├── explainer.py    # rule-based move explanation generator
│   │   │   ├── pgn_parser.py   # PGN → ParsedGame (plies + FENs)
│   │   │   └── summarizer.py   # accuracy, counts, critical moment
│   │   ├── tasks/
│   │   │   ├── celery_app.py   # Celery app instance
│   │   │   └── analysis.py     # analyze_game Celery task
│   │   ├── config.py           # Settings (pydantic-settings, reads .env)
│   │   ├── database.py         # SQLAlchemy async engine + session
│   │   └── main.py             # FastAPI app, CORS, router registration
│   ├── migrations/
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       └── 0002_add_auth_fields.py
│   ├── tests/
│   │   ├── test_classifier.py
│   │   ├── test_pgn_parser.py
│   │   └── test_summarizer.py
│   ├── Dockerfile
│   ├── railway.toml
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── analyze/[gameId]/
│   │   │   ├── page.tsx        # server component shell
│   │   │   └── AnalysisView.tsx # client — board + move list + summary
│   │   ├── games/
│   │   │   ├── page.tsx
│   │   │   └── GamesClient.tsx # game history dashboard
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── layout.tsx          # AuthProvider + GoogleProvider + NavBar
│   │   ├── page.tsx            # home / game input
│   │   └── globals.css         # CSS variables, dark theme, analysis grid
│   ├── components/
│   │   ├── AnalysisBoard.tsx   # react-chessboard wrapper + arrow overlays
│   │   ├── AnalysisLoader.tsx  # polls /status every 2s during analysis
│   │   ├── EvalBar.tsx         # vertical evaluation bar
│   │   ├── GameInput.tsx       # PGN/URL textarea + color picker
│   │   ├── GameSummary.tsx     # accuracy + classification count display
│   │   ├── GoogleProvider.tsx  # client wrapper for GoogleOAuthProvider
│   │   ├── GoogleSignInButton.tsx # Google Identity Services button
│   │   ├── MoveFeedback.tsx    # single-move explanation panel
│   │   ├── MoveList.tsx        # scrollable move list with classification colors
│   │   └── NavBar.tsx          # auth-aware navigation header
│   ├── contexts/
│   │   └── AuthContext.tsx     # JWT in localStorage, login/logout/register
│   ├── lib/
│   │   ├── api.ts              # fetch wrapper — auto-attaches Bearer token
│   │   ├── auth.ts             # token storage + register/login API calls
│   │   ├── classification.ts   # classification → label/color/symbol config
│   │   └── session.ts          # legacy session token helpers (kept for reference)
│   ├── types/
│   │   └── analysis.ts         # TypeScript interfaces for all API shapes
│   ├── vercel.json
│   └── package.json
│
├── docker-compose.yml          # postgres + redis + migrate + api + worker
└── .gitignore
```

---

## Local development setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Redis
- Stockfish (16 or 18)

**macOS (Homebrew):**
```bash
brew install postgresql@16 redis stockfish
brew services start postgresql@16
brew services start redis
```

### 1. Clone and set up the backend

```bash
git clone https://github.com/yourusername/SochMate.git
cd SochMate/backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create the database:
```bash
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE USER sochmate WITH PASSWORD 'sochmate';"
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE DATABASE sochmate OWNER sochmate;"
```

Copy the example env file and edit it:
```bash
cp .env.example .env
```

`.env` — minimum required values:
```env
DATABASE_URL=postgresql+asyncpg://sochmate:sochmate@localhost:5432/sochmate
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
STOCKFISH_PATH=/opt/homebrew/bin/stockfish   # adjust to your path
JWT_SECRET_KEY=change-this-to-a-long-random-string

# Optional — only needed if you want Google sign-in
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Run migrations:
```bash
alembic upgrade head
```

Start the API server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start the Celery worker (in a separate terminal):
```bash
source .venv/bin/activate
python -m celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
```

### 2. Set up the frontend

```bash
cd ../frontend
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional — only needed for Google sign-in
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Start the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Docker Compose (alternative)

If you prefer containers:
```bash
docker compose up
```

This starts PostgreSQL, Redis, runs migrations, then starts the API and worker. The frontend still needs to run locally with `npm run dev`.

### 4. Verify everything works

```bash
# Health check
curl http://localhost:8000/health
# → {"status":"ok"}

# Register an account
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"testpass123"}'
# → {"access_token":"eyJ...","user_id":"...","email":"..."}
```

---

## Environment variables reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Yes | — | Redis connection string |
| `CELERY_BROKER_URL` | Yes | — | Same as `REDIS_URL` or a different Redis DB |
| `CELERY_RESULT_BACKEND` | Yes | — | Redis DB for Celery results (use `/1` to separate from broker) |
| `STOCKFISH_PATH` | Yes | `/usr/games/stockfish` | Absolute path to the Stockfish binary |
| `STOCKFISH_DEPTH` | No | `18` | Search depth (higher = more accurate, slower) |
| `STOCKFISH_TIME_LIMIT` | No | `0.1` | Seconds per position (lower = faster, less accurate) |
| `JWT_SECRET_KEY` | Yes | `change-me-in-production` | Secret for signing JWTs — use a long random string in production |
| `JWT_EXPIRE_DAYS` | No | `30` | JWT token lifetime in days |
| `GOOGLE_CLIENT_ID` | No | `""` | Google OAuth client ID — leave empty to disable Google sign-in |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Comma-separated list of allowed frontend origins |
| `MAX_MOVES_PER_GAME` | No | `150` | Reject PGNs with more than this many half-moves |
| `DEBUG` | No | `false` | Enable FastAPI debug mode |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Base URL of the FastAPI backend |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | `""` | Google OAuth client ID — leave empty to hide Google button |

---

## Authentication

SochMate uses **JWT tokens stored in `localStorage`**.

### Email + password

- `POST /api/auth/register` — creates account, returns JWT
- `POST /api/auth/login` — verifies credentials, returns JWT
- Passwords are hashed with `bcrypt` (cost factor 12)
- JWTs are signed with `HS256`, expire after 30 days

### Google OAuth

- Frontend uses `@react-oauth/google` (`GoogleLogin` component) which renders the native Google Identity Services popup
- On success, Google returns a signed `id_token` (JWT) to the browser
- Browser POSTs the `id_token` to `POST /api/auth/google`
- FastAPI verifies the token with Google's public keys via `google-auth`
- User is found by email or created if new (no password stored for Google users)
- Returns the same JWT format as email/password login

To enable: set `GOOGLE_CLIENT_ID` in `backend/.env` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `frontend/.env.local`. Get the client ID from [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add `http://localhost:3000` as an authorized JavaScript origin.

### How auth flows through the app

All protected API calls include the header:
```
Authorization: Bearer <jwt>
```

The frontend `lib/api.ts` `request()` function reads the token from `localStorage` and attaches it automatically. The backend `app/api/deps.py` `get_current_user` dependency validates the token on every protected route.

**Protected routes**: `POST /api/games`, `GET /api/users/me/games`, `GET /api/auth/me`  
**Public routes**: `GET /api/games/{id}`, `GET /api/games/{id}/status`, `GET /health`

---

## API reference

### Auth

```
POST /api/auth/register
  Body:    { email, password, username? }
  Returns: { access_token, token_type, user_id, email, username }
  Status:  201 Created | 409 Conflict (email taken)

POST /api/auth/login
  Body:    { email, password }
  Returns: { access_token, token_type, user_id, email, username }
  Status:  200 | 401 Unauthorized

POST /api/auth/google
  Body:    { id_token }  ← Google's id_token from the frontend
  Returns: { access_token, token_type, user_id, email, username }
  Status:  200 | 401 | 501 (Google not configured)

GET /api/auth/me
  Auth:    Bearer token
  Returns: { user_id, email, username }
```

### Games

```
POST /api/games
  Auth:    Bearer token
  Body:    { input, user_color? }
           input = Chess.com URL or raw PGN
           user_color = "white" | "black" | null (auto-detect)
  Returns: { game_id, status: "pending" }
  Status:  202 Accepted | 422 Invalid PGN

GET /api/games/{game_id}/status
  Returns: { game_id, status, error_message }
           status = "pending" | "processing" | "done" | "failed"

GET /api/games/{game_id}
  Returns: full game object with moves array + summary
  Status:  200 Done | 202 Still processing | 404 Not found

GET /api/users/me/games
  Auth:    Bearer token
  Returns: list of game summaries (newest first, max 50)
```

---

## Database schema

```
users
  id              UUID (PK)
  email           TEXT UNIQUE
  hashed_password TEXT          -- null for Google-only accounts
  username        TEXT
  session_token   TEXT UNIQUE   -- legacy, kept for old rows
  chess_com_username TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

games
  id              UUID (PK)
  user_id         UUID (FK → users)
  pgn_raw         TEXT
  source          TEXT          -- "chess_com" | "manual_pgn"
  chess_com_game_id TEXT UNIQUE
  white_player    TEXT
  black_player    TEXT
  user_color      TEXT          -- "white" | "black"
  result          TEXT          -- "1-0" | "0-1" | "1/2-1/2" | "*"
  time_control    TEXT
  eco_code        TEXT
  opening_name    TEXT
  white_elo       INT
  black_elo       INT
  played_at       TIMESTAMPTZ
  status          TEXT          -- "pending" | "processing" | "done" | "failed"
  error_message   TEXT
  created_at      TIMESTAMPTZ

moves
  id              UUID (PK)
  game_id         UUID (FK → games, CASCADE)
  ply_number      INT           -- 1-indexed half-move number
  move_number     INT           -- chess move number (1, 2, 3...)
  color           TEXT          -- "white" | "black"
  san             TEXT          -- Standard Algebraic Notation
  uci             TEXT          -- UCI format (e.g. "e2e4")
  fen_before      TEXT
  fen_after       TEXT
  eval_before_cp  INT           -- centipawns from White's perspective
  eval_after_cp   INT
  eval_before_mate INT          -- NULL if no forced mate
  eval_after_mate  INT
  eval_delta_cp   INT           -- cp loss from moving player's perspective
  best_move_san   TEXT
  best_move_uci   TEXT
  classification  TEXT          -- "best"|"excellent"|"good"|"inaccuracy"|"mistake"|"blunder"
  explanation     TEXT
  pattern_tag     TEXT          -- reserved for V2 pattern detection

game_summaries
  id              UUID (PK)
  game_id         UUID (FK → games, UNIQUE, CASCADE)
  accuracy_white  NUMERIC(5,2)
  accuracy_black  NUMERIC(5,2)
  blunders_white  INT
  blunders_black  INT
  mistakes_white  INT
  mistakes_black  INT
  inaccuracies_white INT
  inaccuracies_black INT
  critical_moment_ply INT
  summary_text    TEXT
  analysis_time_ms INT
  created_at      TIMESTAMPTZ
```

---

## Running tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

Tests cover:
- PGN parser — normal games, Scholar's Mate, illegal moves, multi-game PGN, edge-case headers
- Move classifier — all classification boundaries, mate transitions, already-losing positions
- Summarizer — accuracy formula, classification counts, critical moment detection

Note: tests do **not** require Stockfish or a database — the engine layer is not tested here.

---

## Deployment

### Backend → Railway

`backend/railway.toml` is pre-configured:
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

Set these environment variables in Railway:
- `DATABASE_URL` (Railway Postgres add-on)
- `REDIS_URL` (Railway Redis add-on)
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` (same Redis)
- `STOCKFISH_PATH` — Railway's Nixpacks builder can install Stockfish via a `nixpacks.toml`
- `JWT_SECRET_KEY` — generate with `python -c "import secrets; print(secrets.token_hex(32))"`

### Frontend → Vercel

`frontend/vercel.json` points `NEXT_PUBLIC_API_URL` at a Vercel secret `@sochmate_api_url`. Set it to your Railway backend URL.

---

## What's built (current state)

- [x] PGN parsing and board reconstruction
- [x] Stockfish evaluation pipeline (async via Celery)
- [x] Move classification (Best → Blunder)
- [x] Rule-based move explanations
- [x] Game accuracy scores (Chess.com formula)
- [x] Chess.com game URL ingestion with retry
- [x] Interactive analysis board with eval bar + best-move arrows
- [x] Move list with classification colors and keyboard navigation
- [x] Email/password authentication (bcrypt + JWT)
- [x] Google OAuth sign-in
- [x] Game history dashboard
- [x] Docker Compose for local dev
- [x] Railway + Vercel deployment configs

## What's coming (V2 roadmap)

- [ ] **Pattern detection** — surface recurring mistakes across your game history (e.g. "you blunder in endgames 4 times this month")
- [ ] **Opening detection** — display the opening name prominently, filter your history by opening
- [ ] **Deploy** — live at a real URL
- [ ] **Chess.com auto-import** — connect your Chess.com username and import recent games in bulk
- [ ] **AI explanations** — richer natural-language explanations via Claude API (currently rule-based to keep it free)

---

## Design decisions worth noting

**Why Celery + Redis instead of async tasks in FastAPI?**  
Stockfish is a synchronous subprocess. Running it inside FastAPI's async event loop would block all other requests. Celery workers run in separate processes, each with their own Stockfish instance, with no concurrency issues.

**Why not use better-auth or NextAuth?**  
Both are TypeScript-only. Our backend is FastAPI, which is the single source of truth for auth. Adding a JS auth layer would mean two places validating tokens. Instead we built a thin JWT layer directly in FastAPI (~150 lines) and added Google OAuth as a single endpoint.

**Why rule-based explanations instead of an LLM?**  
LLM API calls cost money and add latency per move. A 60-move game would generate 60 API calls. The rule-based explainer in `services/explainer.py` is intentionally written with a stable function signature — swapping it for a Claude API call later is a one-file change.

**Why localStorage for JWTs instead of httpOnly cookies?**  
Simpler for a cross-origin setup (FastAPI on Railway, Next.js on Vercel). httpOnly cookies require same-site or carefully configured `SameSite=None; Secure` headers. This is a known tradeoff — if XSS is a concern for your deployment, switching to httpOnly cookies is straightforward.

---

## Contributing

This is an open project. Issues and PRs are welcome.

The codebase is intentionally structured so each layer is independently readable:
- `services/` — pure functions, no FastAPI/SQLAlchemy imports, easy to test
- `api/` — thin HTTP layer, delegates to services
- `tasks/` — orchestrates the pipeline, uses synchronous SQLAlchemy

If you're adding a new analysis feature, the pattern is: add logic to `services/`, call it from `tasks/analysis.py`, expose it through `api/games.py`.

---

## License

MIT
