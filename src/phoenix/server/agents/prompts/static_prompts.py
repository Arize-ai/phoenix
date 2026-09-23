from __future__ import annotations

from functools import lru_cache
from pathlib import Path

STATIC_PROMPTS_DIR = Path(__file__).parent / "static"


@lru_cache(maxsize=None)
def read_static_prompt(name: str) -> str:
    """Return the verbatim text of a static prompt, relative to ``static/``."""
    text = (STATIC_PROMPTS_DIR / name).read_text(encoding="utf-8")
    return text[:-1] if text.endswith("\n") else text
