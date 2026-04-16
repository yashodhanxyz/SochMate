from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str = "postgresql+asyncpg://sochmate:sochmate@localhost:5432/sochmate"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Stockfish
    stockfish_path: str = "/usr/games/stockfish"
    stockfish_depth: int = 18
    stockfish_time_limit: float = 0.1  # seconds per position

    # Chess.com API base
    chess_com_api_base: str = "https://api.chess.com/pub"

    # App
    debug: bool = False
    # Comma-separated in env: CORS_ORIGINS=https://sochmate.app,https://www.sochmate.app
    cors_origins: list[str] = ["http://localhost:3000"]
    # Maximum moves to analyze per game (prevents runaway jobs on very long games)
    max_moves_per_game: int = 150


settings = Settings()
