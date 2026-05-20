from __future__ import annotations

from pathlib import Path

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


def get_template(name: str) -> Template:
    return _env.get_template(name)
