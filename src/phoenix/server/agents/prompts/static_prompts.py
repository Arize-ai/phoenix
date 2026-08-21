from __future__ import annotations

from functools import lru_cache
from pathlib import Path

STATIC_PROMPTS_DIR = Path(__file__).parent / "static"
"""Prompts that are literal text, with no templating engine behind them.

Everything under this directory is read verbatim. That is the point: these are
the prompts that sit in the provider prompt-cache *prefix*, ahead of every
message in the conversation, so a single varying byte throws away the cached
work for the whole conversation behind it. A file here cannot interpolate
anything, because there is nothing to interpolate it with — the guarantee is
structural rather than a convention someone has to remember.

Prompts that legitimately vary with per-run state live outside this directory
and keep their Jinja templates; their rendered text belongs in the tail, after
the cache breakpoint.
"""


@lru_cache(maxsize=None)
def read_static_prompt(name: str) -> str:
    """Return the verbatim text of a static prompt, relative to ``static/``.

    One trailing newline is stripped, matching Jinja's
    ``keep_trailing_newline=False``. Files here are checked in with the trailing
    newline every editor and linter expects; stripping it on read keeps the
    bytes sent to the provider identical to what the equivalent ``.render()``
    call produced before these prompts stopped being templates.

    Args:
        name: Path of the prompt file relative to ``static/``, e.g.
            ``"base/BASE_INSTRUCTIONS.xml"``.

    Returns:
        The file's text, minus at most one trailing newline.
    """
    text = (STATIC_PROMPTS_DIR / name).read_text(encoding="utf-8")
    return text[:-1] if text.endswith("\n") else text
