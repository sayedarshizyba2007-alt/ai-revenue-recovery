import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env():
    """
    Loads environment variables from available .env files in priority order:
    1. Root directory .env (c:/Users/USER/Desktop/track3-revenue-recovery/.env)
    2. Virtual environment .env
    3. System / Process environment variables
    """
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=True)
    venv_env = BASE_DIR / ".venv" / ".env"
    if venv_env.exists():
        load_dotenv(dotenv_path=venv_env, override=True)
    load_dotenv(override=True)


class Settings:
    """Central configuration class for backend environment settings."""

    @property
    def SUPABASE_URL(self) -> str:
        _load_env()
        val = os.getenv("SUPABASE_URL", "").strip()
        return val.strip("\"'").strip()

    @property
    def SUPABASE_KEY(self) -> str:
        _load_env()
        val = os.getenv("SUPABASE_KEY", "").strip()
        return val.strip("\"'").strip()

    @property
    def GEMINI_API_KEY(self) -> str:
        _load_env()
        val = os.getenv("GEMINI_API_KEY", "").strip()
        return val.strip("\"'").strip()

    @property
    def is_supabase_configured(self) -> bool:
        url = self.SUPABASE_URL
        key = self.SUPABASE_KEY
        is_placeholder_url = url.startswith("https://your-project") or url == ""
        is_placeholder_key = key.startswith("your-supabase") or key == ""
        return bool(url and key and not is_placeholder_url and not is_placeholder_key)

    @property
    def is_gemini_configured(self) -> bool:
        key = self.GEMINI_API_KEY
        return bool(key and not key.startswith("your-gemini") and key != "")

    @property
    def db_mode(self) -> str:
        if self.is_supabase_configured:
            return "SUPABASE"
        return "LOCAL_DEMO_MODE"


settings = Settings()
