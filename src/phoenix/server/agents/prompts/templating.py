from __future__ import annotations

from pathlib import Path, PurePosixPath
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, StrictUndefined, Template

from phoenix.server.agents.context import sanitize_untrusted_value

_TEMPLATES_DIR = Path(__file__).parent

_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=False,  # escaping `<` to `&lt;` would corrupt the XML scaffolding
    keep_trailing_newline=False,
    undefined=StrictUndefined,  # raise on a missing variable instead of silently rendering empty
    trim_blocks=True,
    lstrip_blocks=True,
)
_env.filters["sanitize"] = sanitize_untrusted_value


def urlencode(value: object) -> str:
    return quote(str(value), safe="")


_env.filters["urlencode"] = urlencode


def get_template(name: str) -> Template:
    """Return the Jinja template at ``name``, relative to ``prompts/``.

    Prompts under ``static/`` are deliberately unreachable from here: they are
    literal text read by
    :func:`phoenix.server.agents.prompts.static_prompts.read_static_prompt`, and
    routing one through the engine would reintroduce the interpolation the split
    exists to prevent.
    """
    if PurePosixPath(name).parts[:1] == ("static",):
        raise ValueError(
            f"{name!r} is a static prompt; read it with read_static_prompt() "
            f"instead of rendering it"
        )
    return _env.get_template(name)
