"""The authoring surface mirrors this module's vocabulary, and the two must agree.

``js/app/src/pages/project/evaluators/evaluatorBoundVariables.ts`` repeats the
names in :mod:`phoenix.server.online_eval.bound_variables` so the evaluator
editor can order and describe them without asking the server. Nothing generates
one list from the other, so these tests are the seam that holds them together:
a name the filter language gains or loses changes the derived vocabulary here
and fails until the frontend list is edited to match.
"""

from __future__ import annotations

import re
from pathlib import Path

from phoenix.server.online_eval.bound_variables import (
    SESSION_BOUND_VARIABLE_NAMES,
    SPAN_BOUND_VARIABLE_NAMES,
)

_MIRROR = (
    Path(__file__).parents[4]
    / "js"
    / "app"
    / "src"
    / "pages"
    / "project"
    / "evaluators"
    / "evaluatorBoundVariables.ts"
)


def _mirrored_names(declaration: str) -> set[str]:
    """The names listed under one ``EvaluatorBoundVariable[]`` declaration."""
    source = _MIRROR.read_text(encoding="utf-8")
    block = re.search(
        rf"const {declaration}: EvaluatorBoundVariable\[\] = \[(.*?)^\];",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert block is not None, (
        f"No `{declaration}` declaration in {_MIRROR.name}. If it was renamed or "
        "restructured, update this test to read the new shape."
    )
    return set(re.findall(r'name:\s*"([^"]+)"', block.group(1)))


def test_span_vocabulary_matches_the_authoring_surface() -> None:
    assert _mirrored_names("SPAN_BOUND_VARIABLES") == set(SPAN_BOUND_VARIABLE_NAMES), (
        f"The span names in {_MIRROR.name} no longer match the ones an evaluation "
        "binds. Edit that list so the editor offers exactly what the server supplies."
    )


def test_session_vocabulary_matches_the_authoring_surface() -> None:
    assert _mirrored_names("SESSION_BOUND_VARIABLES") == set(SESSION_BOUND_VARIABLE_NAMES), (
        f"The session names in {_MIRROR.name} no longer match the ones an evaluation "
        "binds. Edit that list so the editor offers exactly what the server supplies."
    )
